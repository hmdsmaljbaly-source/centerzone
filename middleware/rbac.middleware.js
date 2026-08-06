/**
 * RBAC Middleware for role-based access control.
 * Ensure to mount authMiddleware before this.
 * @param {string[]} allowedRoles Array of roles that are allowed to access the route
 */
const rbacMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'User role not found' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};

module.exports = rbacMiddleware;
