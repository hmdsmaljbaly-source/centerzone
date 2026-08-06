const prisma = require('../config/prisma');

exports.scanBarcode = async (req, res) => {
  try {
    const { studentBarcode, groupId } = req.body;
    
    // Atomic Transaction to decrement session and record attendance
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: {
          centerId: req.tenantId,
          OR: [
            { barcode: studentBarcode },
            { code: studentBarcode }
          ]
        }
      });

      if (!student) {
        throw new Error('Student not found');
      }

      // Check remaining sessions
      if (student.remainingSessions <= 0) {
        // Record attendance but return warning
        await tx.attendance.create({
          data: {
            centerId: req.tenantId,
            student_id: student.id,
            group_id: groupId,
            date: new Date(),
            status: 'PRESENT'
          }
        });
        return { student, warning: "Needs Recharge Alert", needsRecharge: true };
      }

      // Decrement sessions
      const updatedStudent = await tx.student.update({
        where: { id: student.id },
        data: { remainingSessions: { decrement: 1 } }
      });

      // Record attendance
      const attendance = await tx.attendance.create({
        data: {
          centerId: req.tenantId,
          student_id: student.id,
          group_id: groupId,
          date: new Date(),
          status: 'PRESENT'
        }
      });

      let warning = null;
      let needsRecharge = false;
      if (updatedStudent.remainingSessions === 0) {
        warning = "Zero-Balance Alert: Session depleted!";
        needsRecharge = true;
      }

      return { student: updatedStudent, attendance, warning, needsRecharge };
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Scanner Error:", err);
    res.status(400).json({ success: false, message: err.message || 'Scan failed' });
  }
};

exports.getGroupAttendanceStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Get students in group
    const students = await prisma.student.findMany({
      where: { centerId: req.tenantId, groupId: groupId },
      include: {
        attendances: {
          where: { date: new Date() } // today's attendance
        },
        studentGrades: {
          include: { assessment: true }
        }
      }
    });

    res.status(200).json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch group stats' });
  }
};

exports.createAssessment = async (req, res) => {
  try {
    const { groupId, title, maxScore } = req.body;
    
    const assessment = await prisma.assessment.create({
      data: {
        centerId: req.tenantId,
        groupId: groupId,
        title: title,
        maxScore: parseFloat(maxScore)
      }
    });

    res.status(201).json({ success: true, data: assessment });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to create assessment' });
  }
};

exports.submitGrades = async (req, res) => {
  try {
    const { id } = req.params; // Assessment ID
    const { studentId, score, isAbsent } = req.body;

    const grade = await prisma.studentGrade.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: id,
          studentId: studentId
        }
      },
      update: {
        score: parseFloat(score),
        isAbsent: isAbsent || false
      },
      create: {
        centerId: req.tenantId,
        assessmentId: id,
        studentId: studentId,
        score: parseFloat(score),
        isAbsent: isAbsent || false
      }
    });

    res.status(200).json({ success: true, data: grade });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Failed to submit grade' });
  }
};

exports.getAssessmentsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const assessments = await prisma.assessment.findMany({
      where: { centerId: req.tenantId, groupId: groupId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch assessments' });
  }
};

exports.submitGradesBulk = async (req, res) => {
  try {
    const { id } = req.params; // Assessment ID
    const { grades } = req.body; // Array of { studentId, score, isAbsent }

    if (!grades || !Array.isArray(grades)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let savedCount = 0;
      for (const g of grades) {
        await tx.studentGrade.upsert({
          where: {
            assessmentId_studentId: {
              assessmentId: id,
              studentId: g.studentId
            }
          },
          update: {
            score: parseFloat(g.score) || 0,
            isAbsent: g.isAbsent || false
          },
          create: {
            centerId: req.tenantId,
            assessmentId: id,
            studentId: g.studentId,
            score: parseFloat(g.score) || 0,
            isAbsent: g.isAbsent || false
          }
        });
        savedCount++;
      }
      return savedCount;
    });

    res.status(200).json({ success: true, message: `Successfully saved ${result} grades.` });
  } catch (err) {
    console.error("Bulk Grade Error:", err);
    res.status(400).json({ success: false, message: 'Failed to save grades in bulk' });
  }
};
