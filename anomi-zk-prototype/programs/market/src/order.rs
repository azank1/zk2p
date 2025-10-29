use anchor_lang::prelude::*;

/// Order types supported by the matching engine
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum OrderType {
    /// Limit order - stays in book until filled or cancelled
    Limit,
    /// Market order - fills immediately at best available price
    Market,
    /// Post-only - rejects if would match immediately (maker-only)
    PostOnly,
    /// Immediate-or-cancel - fills immediately, cancels remainder
    ImmediateOrCancel,
    /// Fill-or-kill - must fill completely or reject entirely
    FillOrKill,
}

/// Side of the order book
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Side {
    /// Bid (buy order)
    Bid,
    /// Ask (sell order)
    Ask,
}

impl Side {
    pub fn opposite(&self) -> Self {
        match self {
            Side::Bid => Side::Ask,
            Side::Ask => Side::Bid,
        }
    }
}

/// Payment status for P2P fiat settlement (stub ZK verification)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum PaymentStatus {
    /// Order matched, awaiting payment
    Pending,
    /// Buyer marked as paid
    PaymentMarked,
    /// In 10-second verification window
    SettlementDelay,
    /// Payment verified (stub - always true after delay)
    Verified,
    /// Payment disputed (future)
    Disputed,
}

/// Individual order in the order book
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct Order {
    /// Unique order ID (128-bit for global uniqueness)
    pub order_id: u128,
    /// Owner of the order
    pub owner: Pubkey,
    /// Quantity of base token (remaining to be filled)
    pub quantity: u64,
    /// Original quantity (for tracking fills)
    pub original_quantity: u64,
    /// Price in quote token per base token (scaled by 1e6)
    pub price: u64,
    /// Unix timestamp when order was created
    pub timestamp: i64,
    /// Type of order
    pub order_type: OrderType,
    /// Side (Bid or Ask)
    pub side: Side,
    /// Client-assigned order ID for tracking
    pub client_order_id: u64,
    /// Payment method (for off-chain settlement)
    pub payment_method: [u8; 32], // Fixed-size for better packing
    
    // P2P Payment tracking fields (for fiat settlement with stub ZK verification)
    /// Payment status for matched orders
    pub payment_status: PaymentStatus,
    /// Timestamp when buyer marked payment as made
    pub payment_marked_timestamp: i64,
    /// Timestamp when settlement delay expires (10 seconds after marked)
    pub settlement_timestamp: i64,
}

impl Order {
    pub const LEN: usize = 16 + // order_id
                          32 + // owner
                          8 +  // quantity
                          8 +  // original_quantity
                          8 +  // price
                          8 +  // timestamp
                          1 +  // order_type
                          1 +  // side
                          8 +  // client_order_id
                          32 + // payment_method
                          1 +  // payment_status
                          8 +  // payment_marked_timestamp
                          8;   // settlement_timestamp
    
    /// Create a new order
    pub fn new(
        order_id: u128,
        owner: Pubkey,
        quantity: u64,
        price: u64,
        timestamp: i64,
        order_type: OrderType,
        side: Side,
        client_order_id: u64,
        payment_method: String,
    ) -> Self {
        let mut payment_bytes = [0u8; 32];
        let bytes = payment_method.as_bytes();
        let len = bytes.len().min(32);
        payment_bytes[..len].copy_from_slice(&bytes[..len]);
        
        Self {
            order_id,
            owner,
            quantity,
            original_quantity: quantity,
            price,
            timestamp,
            order_type,
            side,
            client_order_id,
            payment_method: payment_bytes,
            payment_status: PaymentStatus::Pending,
            payment_marked_timestamp: 0,
            settlement_timestamp: 0,
        }
    }
    
    /// Check if order is fully filled
    pub fn is_filled(&self) -> bool {
        self.quantity == 0
    }
    
    /// Get fill percentage (0-100)
    pub fn fill_percentage(&self) -> u64 {
        if self.original_quantity == 0 {
            return 0;
        }
        ((self.original_quantity - self.quantity) * 100) / self.original_quantity
    }
    
    /// Partially fill the order
    pub fn fill(&mut self, fill_quantity: u64) {
        self.quantity = self.quantity.saturating_sub(fill_quantity);
    }
}

/// Generate a unique 128-bit order ID
/// 
/// Format:
/// - High 64 bits: timestamp (32 bits) | sequence (32 bits)
/// - Low 64 bits: hash of owner pubkey
pub fn generate_order_id(
    owner: &Pubkey,
    sequence: u64,
    timestamp: i64,
) -> u128 {
    // High 64 bits: combine timestamp and sequence
    let high = ((timestamp as u64 & 0xFFFFFFFF) << 32) | (sequence & 0xFFFFFFFF);
    
    // Low 64 bits: use first 8 bytes of owner pubkey
    let owner_bytes = owner.to_bytes();
    let low = u64::from_le_bytes([
        owner_bytes[0],
        owner_bytes[1],
        owner_bytes[2],
        owner_bytes[3],
        owner_bytes[4],
        owner_bytes[5],
        owner_bytes[6],
        owner_bytes[7],
    ]);
    
    ((high as u128) << 64) | (low as u128)
}

/// Order queue at a specific price level
/// This is a slab allocator-style structure
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OrderQueue {
    /// Orders at this price level (FIFO queue)
    pub orders: Vec<Order>,
    /// Total quantity at this price level
    pub total_quantity: u64,
}

impl OrderQueue {
    pub fn new() -> Self {
        Self {
            orders: Vec::new(),
            total_quantity: 0,
        }
    }
    
    /// Add an order to the queue
    pub fn push(&mut self, order: Order) {
        self.total_quantity += order.quantity;
        self.orders.push(order);
    }
    
    /// Remove an order by order_id
    pub fn remove(&mut self, order_id: u128) -> Option<Order> {
        if let Some(pos) = self.orders.iter().position(|o| o.order_id == order_id) {
            let order = self.orders.remove(pos);
            self.total_quantity -= order.quantity;
            Some(order)
        } else {
            None
        }
    }
    
    /// Get the first order in the queue (oldest)
    pub fn peek(&self) -> Option<&Order> {
        self.orders.first()
    }
    
    /// Get mutable reference to first order
    pub fn peek_mut(&mut self) -> Option<&mut Order> {
        self.orders.first_mut()
    }
    
    /// Remove and return the first order if it's fully filled
    pub fn pop_if_filled(&mut self) -> Option<Order> {
        if let Some(order) = self.orders.first() {
            if order.is_filled() {
                let order = self.orders.remove(0);
                self.total_quantity -= order.quantity;
                return Some(order);
            }
        }
        None
    }
    
    /// Check if queue is empty
    pub fn is_empty(&self) -> bool {
        self.orders.is_empty()
    }
    
    /// Update total quantity after a fill
    pub fn update_quantity(&mut self, delta: i64) {
        if delta < 0 {
            self.total_quantity = self.total_quantity.saturating_sub((-delta) as u64);
        } else {
            self.total_quantity += delta as u64;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_order_creation() {
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
            123,
            "PayPal".to_string(),
        );
        
        assert_eq!(order.quantity, 100);
        assert_eq!(order.price, 50);
        assert!(!order.is_filled());
    }
    
    #[test]
    fn test_order_fill() {
        let owner = Pubkey::new_unique();
        let order_id = generate_order_id(&owner, 1, 1000);
        
        let mut order = Order::new(
            order_id,
            owner,
            100,
            50,
            1000,
            OrderType::Limit,
            Side::Bid,
            123,
            "PayPal".to_string(),
        );
        
        order.fill(30);
        assert_eq!(order.quantity, 70);
        assert_eq!(order.fill_percentage(), 30);
        assert!(!order.is_filled());
        
        order.fill(70);
        assert_eq!(order.quantity, 0);
        assert!(order.is_filled());
        assert_eq!(order.fill_percentage(), 100);
    }
    
    #[test]
    fn test_order_queue() {
        let owner = Pubkey::new_unique();
        let mut queue = OrderQueue::new();
        
        let order1 = Order::new(
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
        
        let order2 = Order::new(
            generate_order_id(&owner, 2, 1001),
            owner,
            50,
            50,
            1001,
            OrderType::Limit,
            Side::Bid,
            2,
            "PayPal".to_string(),
        );
        
        queue.push(order1);
        queue.push(order2);
        
        assert_eq!(queue.total_quantity, 150);
        assert!(!queue.is_empty());
        
        let removed = queue.remove(order1.order_id).unwrap();
        assert_eq!(removed.order_id, order1.order_id);
        assert_eq!(queue.total_quantity, 50);
    }
    
    #[test]
    fn test_unique_order_ids() {
        let owner1 = Pubkey::new_unique();
        let owner2 = Pubkey::new_unique();
        
        let id1 = generate_order_id(&owner1, 1, 1000);
        let id2 = generate_order_id(&owner1, 2, 1000);
        let id3 = generate_order_id(&owner2, 1, 1000);
        
        assert_ne!(id1, id2); // Different sequence
        assert_ne!(id1, id3); // Different owner
        assert_ne!(id2, id3);
    }
}
