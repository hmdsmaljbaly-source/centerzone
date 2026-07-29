/**
 * ============================================================================
 * Center System SaaS - Core Node.js & Express Application Entry Point
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  QRCode = {
    toDataURL: async (text) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="20">${text}</text></svg>`
  };
}

const app = express();

// ============================================================================
// 1. MIDDLEWARES & STATIC FILES CONFIGURATION
// ============================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve('public');
app.use(express.static(publicDir));

app.use((req, res, next) => {
  req.centerId = req.headers['x-center-id'] || 'center-101';
  next();
});

// ============================================================================
// 2. API ENDPOINTS
// ============================================================================
const apiRouter = express.Router();

// ----------------------------------------------------------------------------
// AUTH & SUPER ADMIN
// ----------------------------------------------------------------------------
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة السر غير صحيحة'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        centerId: user.centerId
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/super-admin/centers', async (req, res) => {
  try {
    const centers = await prisma.center.findMany({
      include: {
        users: true
      }
    });

    return res.status(200).json({
      success: true,
      count: centers.length,
      data: centers
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/super-admin/centers', async (req, res) => {
  try {
    const { name, email, phone, username, password, subscription_status } = req.body;

    const newCenter = await prisma.center.create({
      data: {
        name,
        email: email || `${username}@center.com`,
        phone: phone || '',
        password_hash: password || '123456',
        subscription_status: subscription_status || 'ACTIVE',
        users: {
          create: {
            username,
            password: password || '123456',
            role: 'CENTER_ADMIN'
          }
        }
      },
      include: {
        users: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'تم إضافة السنتر وتكاويد المدير بنجاح',
      data: newCenter
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------------
// STUDENTS
// ----------------------------------------------------------------------------
apiRouter.get('/students', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: { center_id: req.centerId }
    });

    return res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/students', async (req, res) => {
  try {
    const { name, student_phone, parent_phone, alert_note, alert_status } = req.body;

    if (!name || !parent_phone) {
      return res.status(400).json({
        success: false,
        message: 'اسم الطالب ورقم ولي الأمر مطلوبان'
      });
    }

    const newCode = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(JSON.stringify({ code: newCode, centerId: req.centerId }));
    } catch (e) {
      qrDataUrl = '';
    }

    const newStudent = await prisma.student.create({
      data: {
        center_id: req.centerId,
        student_code: newCode,
        name: name.trim(),
        student_phone: student_phone || '',
        parent_phone: parent_phone.trim(),
        alert_status: Boolean(alert_status),
        alert_note: alert_note || ''
      }
    });

    return res.status(201).json({
      success: true,
      message: 'تم إضافة الطالب بنجاح وتوليد رمز الـ QR',
      data: {
        ...newStudent,
        qr_code: qrDataUrl
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/students/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { id: id },
          { student_code: id }
        ]
      },
      include: {
        attendances: true,
        grades: true
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    return res.status(200).json({ success: true, data: student });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.patch('/students/:id/alert', async (req, res) => {
  try {
    const { id } = req.params;
    const { alert_status, alert_note } = req.body;

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        alert_status: alert_status !== undefined ? Boolean(alert_status) : undefined,
        alert_note: alert_note !== undefined ? alert_note : undefined
      }
    });

    return res.status(200).json({ success: true, message: 'تم تحديث التنبيه بنجاح', data: updatedStudent });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------------
// GROUPS & ATTENDANCE
// ----------------------------------------------------------------------------
apiRouter.get('/groups/today', async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = days[new Date().getDay()];

    const groups = await prisma.group.findMany({
      where: { center_id: req.centerId },
      include: { teacher: true }
    });

    return res.status(200).json({
      success: true,
      today: todayName,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/attendance/scan-qr', async (req, res) => {
  try {
    const { qr_payload, student_code, group_id } = req.body;
    let code = student_code || qr_payload;

    if (qr_payload) {
      try {
        const parsed = JSON.parse(qr_payload);
        code = parsed.code || qr_payload;
      } catch (e) {
        code = qr_payload;
      }
    }

    const student = await prisma.student.findFirst({
      where: { student_code: code, center_id: req.centerId }
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        is_allowed: false,
        message: 'كود الطالب غير مسجل بالسنتر'
      });
    }

    if (student.alert_status) {
      return res.status(403).json({
        success: false,
        is_allowed: false,
        message: 'يوجد تنبيه/حظر على الطالب!',
        student: student
      });
    }

    if (group_id) {
      const attendance = await prisma.attendance.create({
        data: {
          student_id: student.id,
          group_id: group_id,
          date: new Date(),
          status: 'PRESENT'
        }
      });

      return res.status(200).json({
        success: true,
        is_allowed: true,
        message: `تم تسجيل حضور الطالب/ة ${student.name}`,
        data: {
          attendance_id: attendance.id,
          student: student
        }
      });
    }

    return res.status(200).json({
      success: true,
      is_allowed: true,
      message: `تم التحقق من الطالب/ة ${student.name}`,
      data: { student }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------------------------------
// TEACHERS & INVENTORY
// ----------------------------------------------------------------------------
apiRouter.get('/teachers', async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { center_id: req.centerId },
      include: { groups: true, services: true }
    });

    return res.status(200).json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/inventory', async (req, res) => {
  try {
    const services = await prisma.teacherService.findMany({
      where: {
        teacher: { center_id: req.centerId }
      },
      include: { teacher: true }
    });

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Mount API Router
app.use('/api', apiRouter);

// ============================================================================
// 3. PAGE ROUTES & SERVING
// ============================================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/super-admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'super-admin.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Center SaaS Web Engine',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(publicDir, 'index.html'));
  }
  res.status(404).json({ success: false, message: 'المسار المطلوب غير موجود' });
});

// ============================================================================
// 4. SERVER LAUNCH
// ============================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;