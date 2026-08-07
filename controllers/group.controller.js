const prisma = require('../config/prisma');

function parseDays(dayStr) {
  if (!dayStr || typeof dayStr !== 'string') return [];
  const DAYS_LIST = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
  const matches = DAYS_LIST.filter(d => dayStr.includes(d));
  if (matches.length > 0) return matches;
  return dayStr.split(/[-,/ ]+/).map(x => x.trim()).filter(Boolean);
}

async function checkHallConflict(centerId, hallId, dayOfWeek, startTime, endTime, excludeGroupId = null) {
  if (!hallId || !dayOfWeek || !startTime || !endTime) return false;
  const existingGroups = await prisma.group.findMany({
    where: { centerId, hallId }
  });

  const targetDays = parseDays(dayOfWeek);

  return existingGroups.some(g => {
    if (excludeGroupId && g.id === excludeGroupId) return false;
    if (!g.dayOfWeek || !g.startTime || !g.endTime) return false;
    const gDays = parseDays(g.dayOfWeek);
    const hasDayOverlap = targetDays.length > 0 && gDays.length > 0
      ? targetDays.some(d => gDays.includes(d))
      : (g.dayOfWeek === dayOfWeek || g.dayOfWeek.includes(dayOfWeek) || dayOfWeek.includes(g.dayOfWeek));
    
    if (!hasDayOverlap) return false;

    return (startTime < g.endTime && endTime > g.startTime);
  });
}

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
        const group = await prisma.group.findFirst({
            where: { id: id, centerId: req.tenantId },
            include: { 
                teacher: true, 
                hall: true,
                enrollments: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                studentPhone: true,
                                parentPhone: true
                            }
                        }
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

exports.createGroup = async (req, res) => {
  try {
    const { teacher_id, teacherId, hall_id, hallId, name, price, dayOfWeek, startTime, endTime, grade, sessionsPerMonth } = req.body;
    
    const finalTeacherId = teacherId || teacher_id;
    const finalHallId = hallId || hall_id;

    if (!finalTeacherId || !name) {
      return res.status(400).json({ success: false, message: 'المدرس واسم المجموعة مطلوبان' });
    }

    if (await checkHallConflict(req.tenantId, finalHallId, dayOfWeek, startTime, endTime)) {
      return res.status(409).json({ success: false, message: "عفواً، القاعة مشغولة في هذا الوقت بمجموعة أخرى" });
    }

    const group = await prisma.group.create({
      data: {
        centerId: req.tenantId,
        teacherId: finalTeacherId,
        hallId: finalHallId || null,
        name: name.trim(),
        price: parseFloat(price) || 0,
        sessionsPerMonth: parseInt(sessionsPerMonth) || 4,
        dayOfWeek: dayOfWeek || "",
        startTime: startTime || "",
        endTime: endTime || "",
        grade: grade || ""
      }
    });

    res.status(201).json({ success: true, message: 'تم إنشاء المجموعة بنجاح', data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { teacher_id, teacherId, hall_id, hallId, name, price, dayOfWeek, startTime, endTime, grade, sessionsPerMonth } = req.body;
    
    const finalTeacherId = teacherId || teacher_id;
    const finalHallId = hallId || hall_id;

    const existingGroup = await prisma.group.findFirst({ where: { id, centerId: req.tenantId } });
    if (!existingGroup) return res.status(404).json({ success: false, message: "المجموعة غير موجودة بهذا السنتر" });

    if (await checkHallConflict(req.tenantId, finalHallId !== undefined ? finalHallId : existingGroup.hallId, dayOfWeek !== undefined ? dayOfWeek : existingGroup.dayOfWeek, startTime !== undefined ? startTime : existingGroup.startTime, endTime !== undefined ? endTime : existingGroup.endTime, id)) {
      return res.status(409).json({ success: false, message: "عفواً، القاعة مشغولة في هذا الوقت بمجموعة أخرى" });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        teacherId: finalTeacherId !== undefined ? finalTeacherId : existingGroup.teacherId,
        hallId: finalHallId !== undefined ? (finalHallId || null) : existingGroup.hallId,
        name: name !== undefined ? name.trim() : existingGroup.name,
        price: price !== undefined ? parseFloat(price) : existingGroup.price,
        sessionsPerMonth: sessionsPerMonth !== undefined ? parseInt(sessionsPerMonth) : existingGroup.sessionsPerMonth,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : existingGroup.dayOfWeek,
        startTime: startTime !== undefined ? startTime : existingGroup.startTime,
        endTime: endTime !== undefined ? endTime : existingGroup.endTime,
        grade: grade !== undefined ? grade : existingGroup.grade
      }
    });

    res.status(200).json({ success: true, message: "تم تعديل المجموعة بنجاح", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGroupStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.group.findFirst({
      where: { id, centerId: req.tenantId }
    });
    if (!group) {
      return res.status(404).json({ success: false, message: 'المجموعة غير موجودة بهذا السنتر' });
    }
    const sessionsPerMonth = group.sessionsPerMonth ?? 4;

    const students = await prisma.student.findMany({
      where: {
        centerId: req.tenantId,
        OR: [
          { enrollments: { some: { groupId: id } } }
        ]
      },
      orderBy: { name: 'asc' }
    });

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const attendances = await prisma.attendance.findMany({
      where: {
        centerId: req.tenantId,
        group_id: id,
        date: { gte: firstDay, lte: lastDay },
        status: 'PRESENT'
      }
    });

    const studentData = students.map(s => {
      const attendedCount = attendances.filter(a => a.student_id === s.id).length;
      const remainingSessions = Math.max(0, sessionsPerMonth - attendedCount);
      return {
        id: s.id,
        code: s.code,
        barcode: s.barcode || s.code,
        name: s.name,
        phone: s.student_phone || s.parent_phone || 'غير مسجل',
        grade: s.grade || group.grade || 'عام',
        attendedCount,
        remainingSessions,
        sessionsPerMonth
      };
    });

    res.status(200).json({ success: true, count: studentData.length, groupName: group.name, sessionsPerMonth, data: studentData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
