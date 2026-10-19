import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(decoded.id || decoded.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }

    // Optional demo user fallback if no token provided
    // Allows instant testing of UI without forcing immediate login
    const demoUser = await User.findOne({ user_id: 'USR000001' }) || {
      _id: 'USR000001',
      user_id: 'USR000001',
      full_name: 'Ramesh Kumar',
      email: 'ramesh.farmer@agriconnect.ai',
      role: 'farmer',
      state: 'Haryana',
      district: 'Karnal'
    };
    req.user = demoUser;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role))) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
}
