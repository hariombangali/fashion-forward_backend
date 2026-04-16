const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload, uploadCategory } = require('../config/cloudinary');
const {
  getProducts, getWholesaleProducts, getProductBySlug, getProductById,
  createProduct, updateProduct, deleteProduct, updateStock,
  getCategories, createCategory, updateCategory, deleteCategory,
  getFeaturedProducts, searchProducts, suggestProducts, getRelatedProducts,
} = require('../controllers/product.controller');

// Public routes
router.get('/featured', getFeaturedProducts);
router.get('/search', searchProducts);
router.get('/suggest', suggestProducts);
router.get('/categories', getCategories);
router.get('/', optionalAuth, getProducts);
router.get('/slug/:slug', optionalAuth, getProductBySlug);

// Wholesaler routes
router.get('/wholesale', protect, authorize('wholesaler', 'admin'), getWholesaleProducts);

// Related products (public, must be before admin :id routes)
router.get('/:id/related', getRelatedProducts);

// Admin routes
router.post('/', protect, authorize('admin'), upload.array('images', 8), createProduct);
router.get('/admin/:id', protect, authorize('admin'), getProductById);
router.put('/:id', protect, authorize('admin'), upload.array('images', 8), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.put('/:id/stock', protect, authorize('admin'), updateStock);
router.post('/categories', protect, authorize('admin'), uploadCategory.single('image'), createCategory);
router.put('/categories/:id', protect, authorize('admin'), uploadCategory.single('image'), updateCategory);
router.delete('/categories/:id', protect, authorize('admin'), deleteCategory);

module.exports = router;
