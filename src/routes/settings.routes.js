const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload } = require('../config/cloudinary');
const {
  getPublicSettings,
  getSettings,
  updateSettings,
  getRecentPurchases,
} = require('../controllers/settings.controller');

// Public
router.get('/', getPublicSettings);
router.get('/live-purchases', getRecentPurchases);

// Admin
router.get('/admin', protect, authorize('admin'), getSettings);
router.put('/', protect, authorize('admin'), upload.fields([{ name: 'logo' }, { name: 'favicon' }]), updateSettings);

module.exports = router;
