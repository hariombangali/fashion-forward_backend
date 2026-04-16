const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getCart, addToCart, updateCartItem, removeFromCart, clearCart,
  toggleWishlist, getWishlist,
} = require('../controllers/cart.controller');

router.use(protect);

// Cart
router.get('/', getCart);
router.post('/', addToCart);
router.put('/:itemId', updateCartItem);
router.delete('/:itemId', removeFromCart);
router.delete('/', clearCart);

// Wishlist
router.get('/wishlist', getWishlist);
router.post('/wishlist/:productId', toggleWishlist);

module.exports = router;
