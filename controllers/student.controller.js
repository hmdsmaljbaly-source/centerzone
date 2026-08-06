const prisma = require('../config/prisma');

exports.registerStudent = async (req, res) => {
  try {
    const { name, phone, parentPhone, grade, groupId, code } = req.body;
    
    // Validate Prepaid Code using Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find the prepaid card
      const card = await tx.centerPrepaidCard.findFirst({
        where: {
          centerId: req.tenantId,
          code: code,
          status: 'UNUSED'
        }
      });

      // Allow registration without code if allowed by system, but here we strictly follow Scenario A
      if (!card) {
        throw new Error('Invalid or previously used code');
      }

      // 2. Decrement Center's remaining codes if we want (already handled by usedStudentCodes)
      await tx.center.update({
        where: { id: req.tenantId },
        data: { usedStudentCodes: { increment: 1 } }
      });

      // 3. Create Student with 0 remaining sessions (as per blueprint)
      const student = await tx.student.create({
        data: {
          centerId: req.tenantId,
          code: code,
          barcode: code,
          name,
          grade: grade || "",
          student_phone: phone,
          parent_phone: parentPhone,
          remainingSessions: 0,
          groupId: groupId || null
        }
      });

      // 4. Mark card as USED and link to student
      await tx.centerPrepaidCard.update({
        where: { id: card.id },
        data: {
          status: 'USED',
          studentId: student.id
        }
      });

      // If a group is selected, create enrollment
      if (groupId) {
        await tx.studentEnrollment.create({
          data: {
            centerId: req.tenantId,
            studentId: student.id,
            groupId: groupId
          }
        });
      }

      return student;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("Student Registration Error:", err);
    res.status(400).json({ success: false, message: err.message || 'Registration failed' });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { centerId: req.tenantId },
      include: { group: true }
    });
    res.status(200).json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
};

exports.getStudentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findFirst({
      where: { id, centerId: req.tenantId },
      include: {
        attendances: { include: { group: true }, orderBy: { date: 'desc' } },
        feePayments: { orderBy: { createdAt: 'desc' } },
        studentGrades: { include: { assessment: true }, orderBy: { createdAt: 'desc' } },
        group: true
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch student profile' });
  }
};

exports.payFees = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, sessions, month, discountNote } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Increment remainingSessions
      const student = await tx.student.update({
        where: { id: id },
        data: { remainingSessions: { increment: sessions } }
      });

      // 2. Record Treasury Log
      const payment = await tx.studentFeePayment.create({
        data: {
          centerId: req.tenantId,
          studentId: id,
          amount: parseFloat(amount),
          paymentType: 'MONTHLY',
          monthYear: month || new Date().toISOString().slice(0, 7),
          secretaryName: req.user.username,
        }
      });

      return { student, payment };
    });

    res.status(200).json({ success: true, data: result, message: 'Payment recorded and sessions recharged' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Payment failed' });
  }
};
