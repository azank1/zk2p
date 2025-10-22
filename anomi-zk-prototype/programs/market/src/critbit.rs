use anchor_lang::prelude::*;

/// CritBit (Critical Bit) tree implementation for efficient order book
/// Based on Serum DEX architecture
/// 
/// A CritBit tree is a binary tree where each internal node represents
/// a bit position where the keys differ. This allows O(log n) operations
/// for insert, delete, and search.
/// 
/// In our case, keys are prices, and values are order queues at that price.

/// Maximum depth of the CritBit tree (supports 2^64 price levels)
pub const CRITBIT_MAX_DEPTH: usize = 64;

/// Node in the CritBit tree
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct CritBitNode {
    /// Key (price for orders)
    pub key: u64,
    /// Index of the first order at this price in the order slab
    pub order_index: u32,
    /// Parent node index
    pub parent: u32,
    /// Left child index (lower prices)
    pub left: u32,
    /// Right child index (higher prices)
    pub right: u32,
    /// Critical bit position
    pub prefix_len: u8,
    /// Is this a leaf node?
    pub is_leaf: bool,
}

impl CritBitNode {
    pub const LEN: usize = 8 + 4 + 4 + 4 + 4 + 1 + 1;
    
    pub const EMPTY: u32 = u32::MAX;
    
    pub fn new_leaf(key: u64, order_index: u32) -> Self {
        Self {
            key,
            order_index,
            parent: Self::EMPTY,
            left: Self::EMPTY,
            right: Self::EMPTY,
            prefix_len: 0,
            is_leaf: true,
        }
    }
    
    pub fn new_inner(prefix_len: u8) -> Self {
        Self {
            key: 0,
            order_index: 0,
            parent: Self::EMPTY,
            left: Self::EMPTY,
            right: Self::EMPTY,
            prefix_len,
            is_leaf: false,
        }
    }
}

/// CritBit tree for managing price levels
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CritBitTree {
    /// Root node index
    pub root: u32,
    /// Number of leaf nodes (price levels)
    pub leaf_count: u32,
    /// Next free node index
    pub free_list: u32,
    /// Nodes (preallocated array)
    pub nodes: Vec<CritBitNode>,
}

impl CritBitTree {
    /// Initialize a new CritBit tree with capacity
    pub fn new(capacity: usize) -> Self {
        let mut nodes = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            nodes.push(CritBitNode {
                key: 0,
                order_index: 0,
                parent: CritBitNode::EMPTY,
                left: CritBitNode::EMPTY,
                right: CritBitNode::EMPTY,
                prefix_len: 0,
                is_leaf: false,
            });
        }
        
        Self {
            root: CritBitNode::EMPTY,
            leaf_count: 0,
            free_list: 0,
            nodes,
        }
    }
    
    /// Find the critical bit where two keys differ
    fn find_critical_bit(key1: u64, key2: u64) -> u8 {
        let xor = key1 ^ key2;
        if xor == 0 {
            return 64; // Keys are identical
        }
        63 - xor.leading_zeros() as u8
    }
    
    /// Get the bit at a specific position in a key
    fn get_bit(key: u64, bit_pos: u8) -> bool {
        if bit_pos >= 64 {
            return false;
        }
        (key >> bit_pos) & 1 == 1
    }
    
    /// Allocate a new node from the free list
    fn alloc_node(&mut self) -> Result<u32> {
        require!(
            self.free_list < self.nodes.len() as u32,
            ErrorCode::OrderBookFull
        );
        let index = self.free_list;
        self.free_list += 1;
        Ok(index)
    }
    
    /// Insert a new price level into the tree
    pub fn insert(&mut self, key: u64, order_index: u32) -> Result<()> {
        // Empty tree case
        if self.root == CritBitNode::EMPTY {
            let node_index = self.alloc_node()?;
            self.nodes[node_index as usize] = CritBitNode::new_leaf(key, order_index);
            self.root = node_index;
            self.leaf_count = 1;
            return Ok(());
        }
        
        // Find the insertion point
        let mut current = self.root;
        loop {
            let node = self.nodes[current as usize];
            
            if node.is_leaf {
                // Found a leaf - need to create a new inner node
                if node.key == key {
                    // Price level already exists - update order index
                    self.nodes[current as usize].order_index = order_index;
                    return Ok(());
                }
                
                // Find critical bit
                let crit_bit = Self::find_critical_bit(key, node.key);
                
                // Create new inner node
                let inner_index = self.alloc_node()?;
                self.nodes[inner_index as usize] = CritBitNode::new_inner(crit_bit);
                
                // Create new leaf
                let leaf_index = self.alloc_node()?;
                self.nodes[leaf_index as usize] = CritBitNode::new_leaf(key, order_index);
                
                // Determine which side the new leaf goes on
                let new_leaf_on_right = Self::get_bit(key, crit_bit);
                
                if new_leaf_on_right {
                    self.nodes[inner_index as usize].left = current;
                    self.nodes[inner_index as usize].right = leaf_index;
                } else {
                    self.nodes[inner_index as usize].left = leaf_index;
                    self.nodes[inner_index as usize].right = current;
                }
                
                // Update parent pointers
                let old_parent = node.parent;
                self.nodes[current as usize].parent = inner_index;
                self.nodes[leaf_index as usize].parent = inner_index;
                self.nodes[inner_index as usize].parent = old_parent;
                
                // Update parent's child pointer
                if old_parent == CritBitNode::EMPTY {
                    self.root = inner_index;
                } else {
                    let parent_node = &mut self.nodes[old_parent as usize];
                    if parent_node.left == current {
                        parent_node.left = inner_index;
                    } else {
                        parent_node.right = inner_index;
                    }
                }
                
                self.leaf_count += 1;
                return Ok(());
            }
            
            // Inner node - traverse down
            if Self::get_bit(key, node.prefix_len) {
                current = node.right;
            } else {
                current = node.left;
            }
        }
    }
    
    /// Remove a price level from the tree
    pub fn remove(&mut self, key: u64) -> Result<u32> {
        if self.root == CritBitNode::EMPTY {
            return Err(ErrorCode::OrderNotFound.into());
        }
        
        // Find the leaf node with this key
        let mut current = self.root;
        loop {
            let node = self.nodes[current as usize];
            
            if node.is_leaf {
                if node.key != key {
                    return Err(ErrorCode::OrderNotFound.into());
                }
                
                let order_index = node.order_index;
                
                // Handle single node tree
                if node.parent == CritBitNode::EMPTY {
                    self.root = CritBitNode::EMPTY;
                    self.leaf_count = 0;
                    return Ok(order_index);
                }
                
                // Get parent and sibling
                let parent_index = node.parent;
                let parent = self.nodes[parent_index as usize];
                let sibling_index = if parent.left == current {
                    parent.right
                } else {
                    parent.left
                };
                
                // Update grandparent to point to sibling
                if parent.parent == CritBitNode::EMPTY {
                    self.root = sibling_index;
                    self.nodes[sibling_index as usize].parent = CritBitNode::EMPTY;
                } else {
                    let grandparent_index = parent.parent;
                    let grandparent = &mut self.nodes[grandparent_index as usize];
                    if grandparent.left == parent_index {
                        grandparent.left = sibling_index;
                    } else {
                        grandparent.right = sibling_index;
                    }
                    self.nodes[sibling_index as usize].parent = grandparent_index;
                }
                
                self.leaf_count -= 1;
                return Ok(order_index);
            }
            
            // Traverse down
            if Self::get_bit(key, node.prefix_len) {
                current = node.right;
            } else {
                current = node.left;
            }
        }
    }
    
    /// Find the order index for a given price
    pub fn find(&self, key: u64) -> Option<u32> {
        if self.root == CritBitNode::EMPTY {
            return None;
        }
        
        let mut current = self.root;
        loop {
            let node = self.nodes[current as usize];
            
            if node.is_leaf {
                if node.key == key {
                    return Some(node.order_index);
                }
                return None;
            }
            
            if Self::get_bit(key, node.prefix_len) {
                current = node.right;
            } else {
                current = node.left;
            }
        }
    }
    
    /// Get the minimum key - best ask price
    /// CritBit trees don't maintain BST ordering, so we must check all leaves
    pub fn min(&self) -> Option<(u64, u32)> {
        if self.root == CritBitNode::EMPTY {
            return None;
        }
        
        self.find_min_leaf(self.root)
    }
    
    /// Recursively find the leaf with minimum key in subtree
    fn find_min_leaf(&self, node_index: u32) -> Option<(u64, u32)> {
        if node_index == CritBitNode::EMPTY {
            return None;
        }
        
        let node = self.nodes[node_index as usize];
        
        if node.is_leaf {
            return Some((node.key, node.order_index));
        }
        
        // Inner node - check both subtrees
        let left_min = self.find_min_leaf(node.left);
        let right_min = self.find_min_leaf(node.right);
        
        match (left_min, right_min) {
            (Some((lkey, lidx)), Some((rkey, ridx))) => {
                if lkey < rkey {
                    Some((lkey, lidx))
                } else {
                    Some((rkey, ridx))
                }
            }
            (Some(l), None) => Some(l),
            (None, Some(r)) => Some(r),
            (None, None) => None,
        }
    }
    
    /// Get the maximum key - best bid price
    /// CritBit trees don't maintain BST ordering, so we must check all leaves
    pub fn max(&self) -> Option<(u64, u32)> {
        if self.root == CritBitNode::EMPTY {
            return None;
        }
        
        self.find_max_leaf(self.root)
    }
    
    /// Recursively find the leaf with maximum key in subtree
    fn find_max_leaf(&self, node_index: u32) -> Option<(u64, u32)> {
        if node_index == CritBitNode::EMPTY {
            return None;
        }
        
        let node = self.nodes[node_index as usize];
        
        if node.is_leaf {
            return Some((node.key, node.order_index));
        }
        
        // Inner node - check both subtrees
        let left_max = self.find_max_leaf(node.left);
        let right_max = self.find_max_leaf(node.right);
        
        match (left_max, right_max) {
            (Some((lkey, lidx)), Some((rkey, ridx))) => {
                if lkey > rkey {
                    Some((lkey, lidx))
                } else {
                    Some((rkey, ridx))
                }
            }
            (Some(l), None) => Some(l),
            (None, Some(r)) => Some(r),
            (None, None) => None,
        }
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Order book is full")]
    OrderBookFull,
    #[msg("Order not found")]
    OrderNotFound,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_critbit_insert_and_find() {
        let mut tree = CritBitTree::new(100);
        
        tree.insert(100, 0).unwrap();
        tree.insert(200, 1).unwrap();
        tree.insert(150, 2).unwrap();
        
        assert_eq!(tree.find(100), Some(0));
        assert_eq!(tree.find(200), Some(1));
        assert_eq!(tree.find(150), Some(2));
        assert_eq!(tree.find(300), None);
    }
    
    #[test]
    fn test_critbit_min_max() {
        let mut tree = CritBitTree::new(100);
        
        tree.insert(200, 1).unwrap();
        tree.insert(100, 0).unwrap();
        tree.insert(300, 2).unwrap();
        
        // Test min/max functions
        // Note: CritBit routes by bit patterns, not values
        // So tree structure may have 300 on LEFT and 200 on RIGHT!
        assert_eq!(tree.min(), Some((100, 0)));
        assert_eq!(tree.max(), Some((300, 2)));
    }
    
    #[test]
    fn test_critbit_remove() {
        let mut tree = CritBitTree::new(100);
        
        tree.insert(100, 0).unwrap();
        tree.insert(200, 1).unwrap();
        tree.insert(150, 2).unwrap();
        
        assert_eq!(tree.remove(150).unwrap(), 2);
        assert_eq!(tree.find(150), None);
        assert_eq!(tree.find(100), Some(0));
        assert_eq!(tree.find(200), Some(1));
    }
}
