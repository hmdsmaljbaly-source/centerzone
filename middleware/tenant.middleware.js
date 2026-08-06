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
    next();
  } catch (error) {
    console.error("Tenant Middleware Error:", error);
    res.status(500).json({ success: false, message: "Internal server error during tenant validation" });
  }
};

module.exports = tenantMiddleware;
