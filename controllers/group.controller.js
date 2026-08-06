const prisma = require('../config/prisma');

exports.getGroups = async (req, res) => {
    try {
        const groups = await prisma.group.findMany({
            where: { centerId: req.tenantId },
            include: { teacher: true, hall: true }
        });
        res.status(200).json({ success: true, data: groups });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch groups' });
    }
};

exports.getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await prisma.group.findUnique({
            where: { id: id },
            include: { 
                teacher: true, 
                hall: true,
                students: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        student_phone: true,
                        parent_phone: true,
                        remainingSessions: true
                    }
                }
            }
        });
        if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
        res.status(200).json({ success: true, data: group });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch group' });
    }
};

exports.getTodayGroups = async (req, res) => {
    // Simplified for now, just returning all groups or logic based on dayOfWeek
    try {
        const groups = await prisma.group.findMany({
            where: { centerId: req.tenantId },
            include: { teacher: true }
        });
        res.status(200).json({ success: true, data: groups });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch groups' });
    }
};
