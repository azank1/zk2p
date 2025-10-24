use anchor_lang::prelude::*;
use crate::critbit::CritBitTree;
use crate::error::ErrorCode;
use crate::order::{Order, OrderQueue, OrderType, Side};

/// Order book with CritBit tree for efficient price-level management
#[account]
pub struct OrderBook {
    /// Market this order book belongs to
    pub market: Pubkey,
    /// Token mint for the base asset
    pub base_mint: Pubkey,
    /// Token mint for the quote asset
    pub quote_mint: Pubkey,
    
    /// Bid side (buy orders) - CritBit tree
    pub bids: CritBitTree,
    /// Ask side (sell orders) - CritBit tree
    pub asks: CritBitTree,
    
    /// Order queues (slab allocator style)
    /// Index in CritBit points to this array
    pub order_queues: Vec<OrderQueue>,
    
    /// Next free slot in order_queues
    pub next_queue_index: u32,
    
    /// Total number of active orders
    pub total_orders: u64,
    
    /// Best bid price (cached for quick access)
    pub best_bid: u64,
    /// Best ask price (cached for quick access)
    pub best_ask: u64,
}

impl OrderBook {
    /// Maximum number of price levels supported
    /// Note: Reduced from 1000 to fit Solana's 10KB PDA limit
    /// This still supports 50 different price levels, much better than Phase 2A's 10 total orders
    pub const MAX_PRICE_LEVELS: usize = 50;
    
    /// Initialize a new order book
    pub fn new(market: Pubkey, base_mint: Pubkey, quote_mint: Pubkey) -> Self {
        let mut order_queues = Vec::with_capacity(Self::MAX_PRICE_LEVELS);
        for _ in 0..Self::MAX_PRICE_LEVELS {
            order_queues.push(OrderQueue::new());
        }
        
        Self {
            market,
            base_mint,
            quote_mint,
            bids: CritBitTree::new(Self::MAX_PRICE_LEVELS),
            asks: CritBitTree::new(Self::MAX_PRICE_LEVELS),
            order_queues,
            next_queue_index: 0,
            total_orders: 0,
            best_bid: 0,
            best_ask: u64::MAX,
        }
    }
    
    /// Insert an order into the book
    pub fn insert_order(&mut self, order: Order) -> Result<()> {
        let tree = match order.side {
            Side::Bid => &mut self.bids,
            Side::Ask => &mut self.asks,
        };
        
        // Check if price level already exists
        if let Some(queue_index) = tree.find(order.price) {
            // Add to existing queue
            self.order_queues[queue_index as usize].push(order);
        } else {
            // Create new price level
            require!(
                self.next_queue_index < Self::MAX_PRICE_LEVELS as u32,
                ErrorCode::OrderBookFull
            );
            
            let queue_index = self.next_queue_index;
            self.next_queue_index += 1;
            
            // Add order to queue
            self.order_queues[queue_index as usize].push(order);
            
            // Insert price level into CritBit tree
            tree.insert(order.price, queue_index)?;
        }
        
        self.total_orders += 1;
        self.update_best_prices()?;
        
        msg!("Order inserted: ID={}, side={:?}, price={}, qty={}", 
             order.order_id, order.side, order.price, order.quantity);
        
        Ok(())
    }
    
    /// Remove an order from the book
    pub fn remove_order(&mut self, order_id: u128, side: Side, price: u64) -> Result<Order> {
        let tree = match side {
            Side::Bid => &mut self.bids,
            Side::Ask => &mut self.asks,
        };
        
        // Find the price level
        let queue_index = tree.find(price)
            .ok_or(ErrorCode::OrderNotFound)?;
        
        // Remove from queue
        let order = self.order_queues[queue_index as usize]
            .remove(order_id)
            .ok_or(ErrorCode::OrderNotFound)?;
        
        // If queue is now empty, remove price level from tree
        if self.order_queues[queue_index as usize].is_empty() {
            tree.remove(price)?;
        }
        
        self.total_orders -= 1;
        self.update_best_prices()?;
        
        msg!("Order removed: ID={}, side={:?}, price={}", 
             order_id, side, price);
        
        Ok(order)
    }
    
    /// Get the best order from a side (lowest ask or highest bid)
    pub fn get_best_order(&self, side: Side) -> Option<&Order> {
        let tree = match side {
            Side::Bid => &self.bids,
            Side::Ask => &self.asks,
        };
        
        let (_price, queue_index) = match side {
            Side::Bid => tree.max()?, // Highest bid
            Side::Ask => tree.min()?, // Lowest ask
        };
        
        self.order_queues[queue_index as usize].peek()
    }
    
    /// Get mutable reference to best order
    pub fn get_best_order_mut(&mut self, side: Side) -> Option<&mut Order> {
        let tree = match side {
            Side::Bid => &self.bids,
            Side::Ask => &self.asks,
        };
        
        let (_price, queue_index) = match side {
            Side::Bid => tree.max()?, // Highest bid
            Side::Ask => tree.min()?, // Lowest ask
        };
        
        self.order_queues[queue_index as usize].peek_mut()
    }
    
    /// Update cached best prices
    fn update_best_prices(&mut self) -> Result<()> {
        self.best_bid = self.bids.max().map(|(price, _)| price).unwrap_or(0);
        self.best_ask = self.asks.min().map(|(price, _)| price).unwrap_or(u64::MAX);
        Ok(())
    }
    
    /// Get order book depth for a side
    pub fn get_depth(&self, side: Side, _levels: usize) -> Vec<(u64, u64)> {
        let tree = match side {
            Side::Bid => &self.bids,
            Side::Ask => &self.asks,
        };
        
        let mut depth = Vec::new();
        // TODO: Implement in-order traversal to get top N levels
        // For now, just return best level
        if let Some((price, queue_index)) = match side {
            Side::Bid => tree.max(),
            Side::Ask => tree.min(),
        } {
            let queue = &self.order_queues[queue_index as usize];
            depth.push((price, queue.total_quantity));
        }
        
        depth
    }
    
    /// Get spread (difference between best bid and best ask)
    pub fn get_spread(&self) -> Option<u64> {
        if self.best_bid == 0 || self.best_ask == u64::MAX {
            return None;
        }
        Some(self.best_ask.saturating_sub(self.best_bid))
    }
    
    /// Get mid price
    pub fn get_mid_price(&self) -> Option<u64> {
        if self.best_bid == 0 || self.best_ask == u64::MAX {
            return None;
        }
        Some((self.best_bid + self.best_ask) / 2)
    }
    
    /// Match an order against the book (multi-order matching)
    /// Returns vector of (price, fill_quantity, order_id) tuples
    pub fn match_order(
        &mut self,
        side: Side,
        max_quantity: u64,
        limit_price: u64,
        taker_owner: Pubkey,
    ) -> Result<Vec<(u64, u64, u128)>> {
        let mut fills = Vec::new();
        let mut remaining_quantity = max_quantity;
        
        // Keep matching until filled or no compatible orders
        while remaining_quantity > 0 {
            // Get best price from opposing side (get value, not reference)
            let best_price_result = match side {
                Side::Bid => self.asks.min(),  // Best ask (lowest price)
                Side::Ask => self.bids.max(),  // Best bid (highest price)
            };
            
            if best_price_result.is_none() {
                break;  // No more orders on opposing side
            }
            
            let (price, queue_index) = best_price_result.unwrap();
            
            // Check if price is acceptable
            let price_acceptable = match side {
                Side::Bid => price <= limit_price,  // Buy: ask price must be <= limit
                Side::Ask => price >= limit_price,  // Sell: bid price must be >= limit
            };
            
            if !price_acceptable {
                break;  // No more acceptable prices
            }
            
            // Get order queue at this price level
            let queue = &mut self.order_queues[queue_index as usize];
            
            // Match against first order in queue (FIFO)
            if let Some(maker_order) = queue.peek_mut() {
                // Self-trade prevention
                if maker_order.owner == taker_owner {
                    msg!("Skipping self-trade: order_id={}", maker_order.order_id);
                    break;  // Don't match against own orders
                }
                
                let fill_quantity = remaining_quantity.min(maker_order.quantity);
                
                // Record fill
                fills.push((price, fill_quantity, maker_order.order_id));
                
                // Update maker order
                maker_order.fill(fill_quantity);
                remaining_quantity -= fill_quantity;
                
                // If maker order fully filled, remove it
                if maker_order.is_filled() {
                    queue.pop_if_filled();
                    
                    // If queue now empty, remove price level from tree
                    if queue.is_empty() {
                        let tree_to_remove = match side {
                            Side::Bid => &mut self.asks,
                            Side::Ask => &mut self.bids,
                        };
                        tree_to_remove.remove(price)?;
                    }
                }
            } else {
                break;  // Queue unexpectedly empty
            }
        }
        
        self.total_orders = self.order_queues
            .iter()
            .map(|q| q.orders.len() as u64)
            .sum();
        
        self.update_best_prices()?;
        
        Ok(fills)
    }
    
    /// Check if matching would result in self-trade
    pub fn would_self_trade(&self, side: Side, owner: &Pubkey) -> bool {
        if let Some(best_order) = self.get_best_order(side.opposite()) {
            return best_order.owner == *owner;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::order::generate_order_id;
    
    #[test]
    fn test_order_book_insert() {
        let market = Pubkey::new_unique();
        let base_mint = Pubkey::new_unique();
        let quote_mint = Pubkey::new_unique();
        let mut book = OrderBook::new(market, base_mint, quote_mint);
        
        let owner = Pubkey::new_unique();
        let order = Order::new(
            generate_order_id(&owner, 1, 1000),
            owner,
            100,
            50,
            1000,
            OrderType::Limit,
            Side::Bid,
            1,
            "PayPal".to_string(),
        );
        
        book.insert_order(order).unwrap();
        assert_eq!(book.total_orders, 1);
        assert_eq!(book.best_bid, 50);
    }
    
    #[test]
    fn test_order_book_best_price() {
        let market = Pubkey::new_unique();
        let base_mint = Pubkey::new_unique();
        let quote_mint = Pubkey::new_unique();
        let mut book = OrderBook::new(market, base_mint, quote_mint);
        
        let owner = Pubkey::new_unique();
        
        // Insert bids at different prices
        for price in [40, 50, 45] {
            let order = Order::new(
                generate_order_id(&owner, price as u64, 1000),
                owner,
                100,
                price,
                1000,
                OrderType::Limit,
                Side::Bid,
                price as u64,
                "PayPal".to_string(),
            );
            book.insert_order(order).unwrap();
        }
        
        // Best bid should be highest price
        assert_eq!(book.best_bid, 50);
        
        // Insert asks at different prices
        for price in [60, 55, 65] {
            let order = Order::new(
                generate_order_id(&owner, price as u64, 1000),
                owner,
                100,
                price,
                1000,
                OrderType::Limit,
                Side::Ask,
                price as u64,
                "PayPal".to_string(),
            );
            book.insert_order(order).unwrap();
        }
        
        // Best ask should be lowest price
        assert_eq!(book.best_ask, 55);
        
        // Spread
        assert_eq!(book.get_spread(), Some(5)); // 55 - 50
        
        // Mid price
        assert_eq!(book.get_mid_price(), Some(52)); // (50 + 55) / 2
    }
    
    #[test]
    fn test_order_book_remove() {
        let market = Pubkey::new_unique();
        let base_mint = Pubkey::new_unique();
        let quote_mint = Pubkey::new_unique();
        let mut book = OrderBook::new(market, base_mint, quote_mint);
        
        let owner = Pubkey::new_unique();
        let order_id = generate_order_id(&owner, 1, 1000);
        let order = Order::new(
            order_id,
            owner,
            100,
            50,
            1000,
            OrderType::Limit,
            Side::Bid,
            1,
            "PayPal".to_string(),
        );
        
        book.insert_order(order).unwrap();
        assert_eq!(book.total_orders, 1);
        
        let removed = book.remove_order(order_id, Side::Bid, 50).unwrap();
        assert_eq!(removed.order_id, order_id);
        assert_eq!(book.total_orders, 0);
        assert_eq!(book.best_bid, 0);
    }
}
