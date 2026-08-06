const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'centerzone_saas_secret_key_2026';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, username, role, etc.
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;
