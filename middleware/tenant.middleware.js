const prisma = require('../config/prisma');

const tenantMiddleware = async (req, res, next) => {
  const centerIdHeader = req.headers['x-center-id'];

  if (!centerIdHeader) {
    return res.status(401).json({ success: false, message: "Missing x-center-id header" });
  }

  try {
    // Lookup center by code or id
    const center = await prisma.center.findFirst({
      where: {
        OR: [
          { centerId: centerIdHeader },
          { id: centerIdHeader }
        ]
      }
    });

    if (!center) {
      return res.status(403).json({ success: false, message: "Invalid Center ID or unauthorized" });
    }

    // Bind the database primary key (UUID) to req.tenantId for isolated scoped queries
    req.tenantId = center.id;

    // Security: verify the authenticated user belongs to this center (skip for super admins)
    if (req.user && req.user.role !== 'SUPER_ADMIN' && req.user.centerId && req.user.centerId !== center.id) {
      return res.status(403).json({ success: false, message: 'Access denied: you do not belong to this center' });
    }

    next();
  } catch (error) {
    console.error("Tenant Middleware Error:", error);
    res.status(500).json({ success: false, message: "Internal server error during tenant validation" });
  }
};

module.exports = tenantMiddleware;
