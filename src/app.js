const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Security
app.use(helmet());
// CORS — allow multiple origins (dev + production)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in early stage; restrict later
    }
  },
  credentials: true,
}));

// Rate limiting — relaxed for dev, strict for production
const isProd = process.env.NODE_ENV === 'production';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProd ? 300 : 10000, // Prod: 300/15min, Dev: effectively unlimited
  message: { success: false, message: 'Too many requests. Try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth rate limiting (stricter in prod only)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 1000,
  message: { success: false, message: 'Too many login attempts. Try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Fashion Forward API is running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/banners', require('./routes/banner.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Error handler
app.use(errorHandler);

module.exports = app;
