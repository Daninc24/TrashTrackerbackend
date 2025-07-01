const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const session = require('express-session');
const jwt = require('jsonwebtoken');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const authLimiter = createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts. Please try again later.');
const apiLimiter = createRateLimit(15 * 60 * 1000, 1000, 'Too many API requests. Please try again later.');
const reportLimiter = createRateLimit(60 * 60 * 1000, 100, 'Too many report submissions. Please try again later.');
const uploadLimiter = createRateLimit(60 * 60 * 1000, 5, 'Too many file uploads. Please try again later.');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://rashtrackr.com',
      'https://www.rashtrackr.com',
      'https://rashtrackr.onrender.com',
      'https://rashtrackr-frontend.onrender.com',
      'https://rashtrackr-web.onrender.com'
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Helmet configuration for security headers
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
};

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict'
  },
  name: 'rashtrackr.sid'
};

// Audit logging middleware
const auditLog = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous',
      userEmail: req.user?.email || 'anonymous'
    };
    
    // Log to console in development, to file in production
    if (process.env.NODE_ENV === 'development') {
      console.log('AUDIT:', logEntry);
    } else {
      // In production, you'd want to log to a file or external service
      console.log('AUDIT:', JSON.stringify(logEntry));
    }
  });
  
  next();
};

// JWT token validation middleware
const validateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    
    next();
  };
};

// Input validation and sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any keys that start with '$' (MongoDB operators)
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('$')) {
        delete req.body[key];
      }
    });
  }
  // Only sanitize req.params, not req.query (req.query is read-only in Express 5+)
  if (req.params && typeof req.params === 'object') {
    Object.keys(req.params).forEach(key => {
      if (key.startsWith('$')) {
        delete req.params[key];
      }
    });
  }
  next();
};

// GDPR compliance middleware
const gdprCompliance = (req, res, next) => {
  // Add GDPR headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  });
  
  next();
};

// Export all security middleware
module.exports = {
  authLimiter,
  apiLimiter,
  reportLimiter,
  uploadLimiter,
  corsOptions,
  helmetConfig,
  sessionConfig,
  auditLog,
  validateToken,
  requireRole,
  sanitizeInput,
  gdprCompliance
}; 