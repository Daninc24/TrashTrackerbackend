const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const session = require('express-session');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');

// Import security middleware
const {
  authLimiter,
  apiLimiter,
  reportLimiter,
  uploadLimiter,
  corsOptions,
  helmetConfig,
  sessionConfig,
  auditLog,
  sanitizeInput,
  gdprCompliance
} = require('./middleware/security');

// Import routes
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');
const statsRoutes = require('./routes/statsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const communityRoutes = require('./routes/communityRoutes');
const securityRoutes = require('./routes/securityRoutes');
const { router: apiRoutes } = require('./routes/apiRoutes');
const searchRoutes = require('./routes/searchRoutes');
const adminRoutes = require('./routes/adminRoutes');

dotenv.config();

const app = express();

// Performance middleware setup
app.use(compression());
app.use(morgan('combined'));

// Security middleware setup
app.use(helmet(helmetConfig));
app.use(cors(corsOptions));
app.use(session(sessionConfig));
// Only sanitize req.body and req.params, not req.query (Express 5+)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});
app.use(hpp());
app.use(gdprCompliance);
app.use(auditLog);
app.use(sanitizeInput);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - apply different limits to different routes
app.use('/api/auth', authLimiter);
app.use('/api/reports', reportLimiter);
app.use('/api', apiLimiter);

app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app; 