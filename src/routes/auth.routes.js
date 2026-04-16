const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  register, login, getMe, updateProfile, changePassword,
  addAddress, updateAddress, deleteAddress, applyWholesaler,
  forgotPassword, resetPassword,
} = require('../controllers/auth.controller');
const { upload } = require('../config/cloudinary');

// Public
router.post('/register', register);
router.post('/login', login);
router.post('/apply-wholesaler', upload.fields([
  { name: 'businessProof', maxCount: 1 },
  { name: 'shopPhoto', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 },
]), applyWholesaler);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.post('/address', protect, addAddress);
router.put('/address/:addressId', protect, updateAddress);
router.delete('/address/:addressId', protect, deleteAddress);

module.exports = router;
