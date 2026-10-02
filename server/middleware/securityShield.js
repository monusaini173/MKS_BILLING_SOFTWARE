const rateLimit = require('express-rate-limit');

/**
 * XSS & HTML Payload Sanitizer Middleware
 * Cleans user string inputs across req.body, req.query, and req.params to prevent XSS attacks
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    // Prevent prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const value = obj[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

const sanitizeInput = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

/**
 * Password Strength Policy Validator
 */
const validatePasswordStrength = (req, res, next) => {
  const { password, newPassword } = req.body;
  const passToTest = password || newPassword;

  if (passToTest) {
    if (typeof passToTest !== 'string' || passToTest.length < 6) {
      return res.status(400).json({
        success: false,
        message: '🛡️ Password Security: Password must be at least 6 characters long.'
      });
    }
  }
  next();
};

const faceAuthLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 600, // Allows smooth real-time continuous live frame verification (up to 10 fps)
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: {
    success: false,
    message: '🛡️ Security Shield: Too many face scan requests. Please wait a moment before trying again.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 15, // max 15 login attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '🛡️ Security Shield: Too many login attempts. Account temporarily locked for 15 minutes to prevent brute-force attacks.',
    code: 'LOGIN_LOCKED'
  }
});

/**
 * Biometric Payload Integrity Validator
 * Prevents buffer overflow, malformed arrays, NaN injections, and payload poisoning
 */
const validateBiometricPayload = (req, res, next) => {
  const { descriptor } = req.body;

  if (descriptor !== undefined) {
    if (!Array.isArray(descriptor) || descriptor.length < 64 || descriptor.length > 1024) {
      return res.status(400).json({
        success: false,
        message: '🛡️ Security Shield: Invalid biometric vector structure or abnormal size.'
      });
    }

    // Verify all vector components are valid finite numbers within normalized bounds
    for (let i = 0; i < descriptor.length; i++) {
      const val = descriptor[i];
      if (typeof val !== 'number' || !isFinite(val) || val < -10.0 || val > 10.0) {
        return res.status(400).json({
          success: false,
          message: '🛡️ Security Shield: Corrupted or malicious biometric float values detected.'
        });
      }
    }
  }

  next();
};

const failedFaceAttempts = new Map();

const recordFailedAttempt = (identifier) => {
  if (process.env.NODE_ENV === 'development') return; // Do not lock out during active local development
  const now = Date.now();
  const entry = failedFaceAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  
  // In live streaming (8 fps), 120 frames represents ~15 seconds of continuously presenting an unauthorized face
  if (entry.count >= 120) {
    entry.lockedUntil = now + 30 * 1000; // 30s lockout after 15s of continuous unknown face
  }
  failedFaceAttempts.set(identifier, entry);
};

const checkAttemptLockout = (identifier) => {
  if (process.env.NODE_ENV === 'development') return { isLocked: false };
  const entry = failedFaceAttempts.get(identifier);
  if (!entry) return { isLocked: false };
  
  if (Date.now() < entry.lockedUntil) {
    const remainingSecs = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { isLocked: true, remainingSecs };
  }
  
  if (Date.now() > entry.lockedUntil && entry.lockedUntil > 0) {
    failedFaceAttempts.delete(identifier);
  }
  return { isLocked: false };
};

const clearFailedAttempts = (identifier) => {
  failedFaceAttempts.delete(identifier);
};

module.exports = {
  sanitizeInput,
  validatePasswordStrength,
  faceAuthLimiter,
  loginLimiter,
  validateBiometricPayload,
  recordFailedAttempt,
  checkAttemptLockout,
  clearFailedAttempts
};

