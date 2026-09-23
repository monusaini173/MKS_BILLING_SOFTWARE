require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const seedSuperAdmin = require('./utils/seedAdmin');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const purchaseRoutes = require('./routes/purchases');
const customerRoutes = require('./routes/customers');
const supplierRoutes = require('./routes/suppliers');
const expenseRoutes = require('./routes/expenses');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const subscriptionRoutes = require('./routes/subscription');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctors');
const aiRoutes = require('./routes/ai');
const staffRoutes = require('./routes/staff');
const branchRoutes = require('./routes/branch');
const documentRoutes = require('./routes/documents');
const { catRouter, brandRouter, settingsRouter, notifRouter, empRouter } = require('./routes/shared');

// Connect to DB
connectDB().then(() => {
  seedSuperAdmin();
});


const app = express();

// Enterprise-grade Cybersecurity Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  frameguard: { action: 'sameorigin' },
  dnsPrefetchControl: { allow: false },
  hidePoweredBy: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// NoSQL Injection Mitigation
app.use(mongoSanitize({
  replaceWith: '_'
}));

// CORS (allows any localhost port in development)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shop-Type', 'X-Shop-Id', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Authorization', 'X-Shop-Type', 'X-Shop-Id']
}));


// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting (generous for local fast POS billing)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'MKS Billing API is running', version: '1.0.0' });
});

// 📲 WhatsApp QR Code Page (Browser mein scan karo)
// Visit: http://localhost:5000/whatsapp-qr
if (process.env.WHATSAPP_ENABLED === 'true') {
  try {
    const { whatsappQrPageHandler, isWhatsAppReady } = require('./utils/whatsappClient');
    app.get('/whatsapp-qr', whatsappQrPageHandler);
    app.get('/whatsapp-status', (req, res) => {
      res.json({ connected: isWhatsAppReady(), message: isWhatsAppReady() ? 'WhatsApp connected ✅' : 'QR scan required ⚠️' });
    });
  } catch (e) {
    console.warn('⚠️ WhatsApp routes could not be registered:', e.message);
  }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', catRouter);
app.use('/api/brands', brandRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/notifications', notifRouter);
app.use('/api/employees', empRouter);
app.use('/api/doctors', doctorRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/documents', documentRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 MKS Billing API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [PORT ERROR] Port ${PORT} already use mein hai!`);
    console.error(`👉 Dusra process port ${PORT} par chal raha hai.`);
  } else {
    console.error('❌ Server Error:', err.message);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = app;
