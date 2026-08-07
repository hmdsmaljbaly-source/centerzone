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

exports.createTeacher = async (req, res) => {
  try {
    const { name, subject, phone, stage, grades, commissionType, commissionValue, commission_type, commission_value } = req.body;

    const finalCommissionType = commissionType || commission_type || 'PERCENTAGE';
    const finalCommissionValue = commissionValue || commission_value || 0;

    if (!name || !subject || !phone) {
      return res.status(400).json({ success: false, message: 'اسم المدرس والمادة ورقم الهاتف بيانات مطلوبة' });
    }

    const teacher = await prisma.teacher.create({
      data: {
        centerId: req.tenantId,
        name: name.trim(),
        subject: subject.trim(),
        phone: phone.trim(),
        stage: stage || null,
        grades: grades || [],
        commissionType: finalCommissionType,
        commissionValue: finalCommissionValue
      }
    });

    res.status(201).json({ success: true, message: 'تم حفظ بيانات المدرس بنجاح', data: teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeacherProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await prisma.teacher.findFirst({
      where: { id, centerId: req.tenantId },
      include: {
        groups: {
          include: {
            hall: true,
            _count: { select: { enrollments: true } }
          }
        },
        services: true,
        payouts: true
      }
    });

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'المدرس غير موجود بهذا السنتر' });
    }

    const groupIds = (teacher.groups || []).map(g => g.id);
    const serviceIds = (teacher.services || []).map(s => s.id);

    const [feePayments, serviceSales, activeStudentsCount] = await Promise.all([
      prisma.studentFeePayment.findMany({ where: { centerId: req.tenantId, OR: [{ groupId: { in: groupIds } }, { serviceId: { in: serviceIds } }] } }),
      prisma.serviceSale.findMany({ where: { centerId: req.tenantId, serviceId: { in: serviceIds } } }),
      prisma.student.count({
        where: {
          centerId: req.tenantId,
          OR: [
            { enrollments: { some: { groupId: { in: groupIds } } } }
          ]
        }
      })
    ]);

    const totalCollected = feePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) + serviceSales.reduce((s, x) => s + (parseFloat(x.amountPaid) || 0), 0);
    const bookletsSales = serviceSales.reduce((s, x) => s + (parseFloat(x.amountPaid) || 0), 0);
    
    const centerPercentage = teacher.centerPercentage != null ? parseFloat(teacher.centerPercentage) : 30.0;
    const teacherPercentage = 100.0 - centerPercentage;

    const centerShare = totalCollected * (centerPercentage / 100.0);
    const teacherShare = totalCollected * (teacherPercentage / 100.0);
    const totalPaidOut = (teacher.payouts || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    const remainingBalance = teacherShare - totalPaidOut;

    const formattedGroups = (teacher.groups || []).map(g => ({
      ...g,
      enrolledCount: g._count?.enrollments || 0,
      sessionsPerMonth: g.sessionsPerMonth ?? 4,
      hallName: g.hall?.name || 'بدون قاعة محددة'
    }));

    const profileData = {
      id: teacher.id,
      name: teacher.name,
      subject: teacher.subject || 'عام',
      phone: teacher.phone || '',
      stage: teacher.stage,
      grades: teacher.grades,
      centerPercentage,
      teacherPercentage,
      activeStudentsCount,
      totalCollected: Number(totalCollected.toFixed(2)),
      bookletsSales: Number(bookletsSales.toFixed(2)),
      centerShare: Number(centerShare.toFixed(2)),
      teacherShare: Number(teacherShare.toFixed(2)),
      totalPaidOut: Number(totalPaidOut.toFixed(2)),
      remainingBalance: Number(remainingBalance.toFixed(2)),
      groups: formattedGroups,
      payouts: teacher.payouts || []
    };

    res.status(200).json({ success: true, data: profileData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
