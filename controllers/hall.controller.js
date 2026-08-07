const prisma = require('../config/prisma');

exports.getHalls = async (req, res) => {
  try {
    const halls = await prisma.hall.findMany({
      where: { centerId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, count: halls.length, data: halls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createHall = async (req, res) => {
  try {
    const { name, capacity } = req.body;
    if (!name || !capacity || parseInt(capacity) <= 0) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال اسم القاعة وسعة صحيحة أكبر من صفر' });
    }
    const hall = await prisma.hall.create({
      data: {
        centerId: req.tenantId,
        name: name.trim(),
        capacity: parseInt(capacity)
      }
    });
    res.status(201).json({ success: true, message: 'تم حفظ القاعة بنجاح', data: hall });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
