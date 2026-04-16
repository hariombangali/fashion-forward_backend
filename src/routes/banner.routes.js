const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload } = require('../config/cloudinary');
const {
  getBanners,
  getAllBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
  reorderBanners,
} = require('../controllers/banner.controller');

// Public
router.get('/', getBanners);

// Admin routes
router.get('/admin', protect, authorize('admin'), getAllBannersAdmin);
router.get('/admin/:id', protect, authorize('admin'), getBannerById);
router.post('/', protect, authorize('admin'), upload.single('image'), createBanner);
router.put('/reorder', protect, authorize('admin'), reorderBanners);
router.put('/:id', protect, authorize('admin'), upload.single('image'), updateBanner);
router.put('/:id/toggle', protect, authorize('admin'), toggleBannerActive);
router.delete('/:id', protect, authorize('admin'), deleteBanner);

module.exports = router;
