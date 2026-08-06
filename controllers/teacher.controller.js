const prisma = require('../config/prisma');

exports.getTeachers = async (req, res) => {
    try {
        const teachers = await prisma.teacher.findMany({
            where: { centerId: req.tenantId }
        });
        res.status(200).json({ success: true, data: teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch teachers' });
    }
};
