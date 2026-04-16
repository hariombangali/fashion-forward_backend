const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Product images ─────────────────────────────────────────────────────────
// Max 1200px wide, quality 88 — good balance for product cards & detail view
const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'fashion-forward/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit', quality: 88, fetch_format: 'auto' }],
  },
});

// ── Banner images ──────────────────────────────────────────────────────────
// Full-width hero banners — store at 1920px, quality 92, NO height cap
const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'fashion-forward/banners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1920, crop: 'limit', quality: 92, fetch_format: 'auto' }],
  },
});

// ── Category images ────────────────────────────────────────────────────────
// Category tile images — 800px wide is plenty for the grid cards
const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'fashion-forward/categories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, crop: 'limit', quality: 88, fetch_format: 'auto' }],
  },
});

const FILE_LIMIT = { fileSize: 10 * 1024 * 1024 }; // 10 MB

const upload = multer({ storage: productStorage, limits: FILE_LIMIT });
const uploadBanner = multer({ storage: bannerStorage, limits: FILE_LIMIT });
const uploadCategory = multer({ storage: categoryStorage, limits: FILE_LIMIT });

module.exports = { cloudinary, upload, uploadBanner, uploadCategory };
