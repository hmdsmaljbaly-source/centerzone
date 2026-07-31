const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('./config/prisma');

let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  QRCode = {
    toDataURL: async (text) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="20">${text}</text></svg>`
  };
}

const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
app.use(express.static(path.resolve('public')));

app.use((req, res, next) => {
  req.centerId = req.headers['x-center-id'] || (req.user && req.user.centerId) || 'center-101';
  next();
});

// HTML Routes Direct Mapping
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));

app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.get('/super-admin', (req, res) => res.sendFile(path.join(publicDir, 'super-admin.html')));
app.get('/super-admin.html', (req, res) => res.sendFile(path.join(publicDir, 'super-admin.html')));

app.get('/students.html', (req, res) => res.sendFile(path.join(publicDir, 'students.html')));
app.get('/teachers.html', (req, res) => res.sendFile(path.join(publicDir, 'teachers.html')));
app.get('/inventory.html', (req, res) => res.sendFile(path.join(publicDir, 'inventory.html')));
app.get('/scanner.html', (req, res) => res.sendFile(path.join(publicDir, 'scanner.html')));
app.get('/settings.html', (req, res) => res.sendFile(path.join(publicDir, 'settings.html')));

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'DOWN', database: 'DISCONNECTED', error: e.message });
  }
});

const apiRouter = express.Router();

// Authentication Endpoint
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة السر غير صحيحة' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password).catch(() => user.password === password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة السر غير صحيحة' });
    }

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        centerId: user.centerId || 'center-101'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Super Admin Management
apiRouter.get('/super-admin/centers', async (req, res) => {
  try {
    const centers = await prisma.center.findMany({
      include: { users: { select: { username: true } } }
    });
    res.status(200).json({ success: true, count: centers.length, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/super-admin/centers', async (req, res) => {
  try {
    const { name, phone, username, password, plan, expiry, allowedStudentCodes, managerPassword } = req.body;
    const plainPassword = password || '123456';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const mngrPassword = managerPassword || '123456';
    const managerPasswordHash = await bcrypt.hash(mngrPassword, 10);

    const center = await prisma.center.create({
      data: {
        name,
        phone,
        email: `${username}@saas-center.com`,
        password_hash: hashedPassword,
        subscription_status: plan || 'ACTIVE',
        expires_at: expiry ? new Date(expiry) : new Date('2026-12-31'),
        allowedStudentCodes: parseInt(allowedStudentCodes) || 0,
        managerPasswordHash
      }
    });

    await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'CENTER_ADMIN',
        centerId: center.id
      }
    });

    res.status(201).json({ success: true, message: 'تم إنشاء السنتر وتكاويد حساب المدير', data: center });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Students API Endpoints
apiRouter.get('/students', async (req, res) => {
  try {
    const { alert_status } = req.query;
    const where = { centerId: req.centerId };

    if (alert_status && alert_status !== 'ALL') {
      if (alert_status === 'NORMAL') where.alert_status = false;
      else if (alert_status === 'WARNING' || alert_status === 'BLOCKED') where.alert_status = true;
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const formatted = students.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      student_phone: s.student_phone || '',
      parent_phone: s.parent_phone,
      alert_status: s.alert_status ? (s.alert_note && s.alert_note.includes('محظور') ? 'BLOCKED' : 'WARNING') : 'NORMAL',
      alert_note: s.alert_note || ''
    }));

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/students', async (req, res) => {
  try {
    const { name, student_phone, parent_phone, alert_note, alert_status } = req.body;

    if (!name || !parent_phone) {
      return res.status(400).json({ success: false, message: 'اسم الطالب ورقم ولي الأمر مطلوبان' });
    }

    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (center.usedStudentCodes >= center.allowedStudentCodes) {
      return res.status(403).json({ error: 'استنفذت باقة الأكواد المتاحة للسنتر. يرجى التواصل مع الإدارة' });
    }

    const newCode = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    const student = await prisma.student.create({
      data: {
        centerId: req.centerId,
        code: newCode,
        name: name.trim(),
        student_phone: student_phone || null,
        parent_phone: parent_phone.trim(),
        alert_status: alert_status === 'WARNING' || alert_status === 'BLOCKED',
        alert_note: alert_note || null,
        isBlocked: alert_status === 'BLOCKED',
        hasFinancialWarning: alert_status === 'WARNING'
      }
    });

    await prisma.center.update({
      where: { id: req.centerId },
      data: { usedStudentCodes: { increment: 1 } }
    });

    res.status(201).json({
      success: true,
      message: 'تم إضافة الطالب بنجاح وتوليد الكود والباركوود',
      data: {
        id: student.id,
        code: student.code,
        name: student.name,
        parent_phone: student.parent_phone,
        student_phone: student.student_phone,
        alert_status: student.alert_status ? 'WARNING' : 'NORMAL',
        alert_note: student.alert_note
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.patch('/students/:id/alert', async (req, res) => {
  try {
    const { alert_status, alert_note } = req.body;
    const isAlert = alert_status === 'WARNING' || alert_status === 'BLOCKED';

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data: { 
        alert_status: isAlert, 
        alert_note: alert_note,
        isBlocked: alert_status === 'BLOCKED',
        hasFinancialWarning: alert_status === 'WARNING'
      }
    });

    res.status(200).json({ success: true, message: 'تم تحديث تنبيه الطالب', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Attendance Scanning Endpoint
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
      where: { centerId: req.centerId, OR: [{ code: code }, { id: code }] }
    });

    if (!student) {
      return res.status(404).json({ success: false, is_allowed: false, message: 'كود الطالب غير مسجل بالسنتر' });
    }

    if (student.isBlocked || (student.alert_status && student.alert_note && student.alert_note.includes('محظور'))) {
      return res.status(403).json({
        success: false,
        is_allowed: false,
        message: 'طالب محظور من دخول القاعة!',
        student: { id: student.id, name: student.name, code: student.code }
      });
    }

    if (group_id) {
      await prisma.attendance.upsert({
        where: {
          student_id_group_id_date: {
            student_id: student.id,
            group_id: group_id,
            date: new Date()
          }
        },
        update: { status: 'PRESENT' },
        create: {
          student_id: student.id,
          group_id: group_id,
          date: new Date(),
          status: 'PRESENT'
        }
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      is_allowed: true,
      message: `تم تسجيل حضور الطالب/ة ${student.name}`,
      data: {
        student: {
          id: student.id,
          code: student.code,
          name: student.name,
          parent_phone: student.parent_phone,
          student_phone: student.student_phone
        },
        alert_notice: student.hasFinancialWarning || student.alert_status ? {
          has_warning: true,
          note: student.alert_note || 'يوجد تنبيه مالي على الطالب'
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Groups & Teachers Endpoints
apiRouter.get('/groups/today', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { centerId: req.centerId },
      include: { teacher: true, hall: true }
    });
    res.status(200).json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/groups', async (req, res) => {
  try {
    const { teacher_id, hall_id, name, price, dayOfWeek, startTime, endTime, grade } = req.body;

    if (!teacher_id || !name) {
      return res.status(400).json({ success: false, message: 'المدرس واسم المجموعة مطلوبان' });
    }

    // Smart Schedule Conflict Engine
    if (hall_id && dayOfWeek && startTime && endTime) {
      const existingGroups = await prisma.group.findMany({
        where: {
          centerId: req.centerId,
          hallId: hall_id,
          dayOfWeek: dayOfWeek
        }
      });
      
      const isConflict = existingGroups.some(g => {
        // Simple string comparison for times works if formats are consistent (e.g. "14:00")
        return (startTime < g.endTime && endTime > g.startTime);
      });

      if (isConflict) {
        return res.status(409).json({ success: false, message: 'يوجد تعارض في الجدول مع مجموعة أخرى في نفس القاعة والتوقيت' });
      }
    }

    const group = await prisma.group.create({
      data: {
        centerId: req.centerId,
        teacherId: teacher_id,
        hallId: hall_id || null,
        name: name.trim(),
        price: price || 0,
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
});

apiRouter.get('/teachers', async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: { center_id: req.centerId },
      include: { groups: true }
    });
    res.status(200).json({ success: true, count: teachers.length, data: teachers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/teachers', async (req, res) => {
  try {
    const { name, subject, phone, stage, grades, commission_type, commission_value } = req.body;

    if (!name || !subject || !phone) {
      return res.status(400).json({ success: false, message: 'اسم المدرس والمادة ورقم الهاتف بيانات مطلوبة' });
    }

    const teacher = await prisma.teacher.create({
      data: {
        center_id: req.centerId,
        name: name.trim(),
        subject: subject.trim(),
        phone: phone.trim(),
        stage: stage || null,
        grades: grades || [],
        commission_type: commission_type || 'PERCENTAGE',
        commission_value: commission_value || 0
      }
    });

    res.status(201).json({ success: true, message: 'تم حفظ بيانات المدرس بنجاح', data: teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Inventory POS Endpoints
apiRouter.get('/inventory', async (req, res) => {
  try {
    const booklets = await prisma.booklet.findMany({
      where: { centerId: req.centerId },
      include: { center: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, count: booklets.length, data: booklets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/inventory', async (req, res) => {
  try {
    const { title, teacher_id, price, stock_quantity } = req.body;

    if (!title || !teacher_id || price === undefined || stock_quantity === undefined) {
      return res.status(400).json({ success: false, message: 'جميع بيانات الملزمة مطلوبة (الاسم، المدرس، السعر، والكمية)' });
    }

    const newBook = await prisma.booklet.create({
      data: {
        centerId: req.centerId,
        title: title.trim(),
        price: parseFloat(price),
        quantity: parseInt(stock_quantity),
        teacherId: teacher_id
      }
    });

    res.status(201).json({ success: true, message: 'تمت إضافة الملزمة للمخزن بنجاح', data: newBook });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.delete('/inventory/:id', async (req, res) => {
  try {
    await prisma.booklet.delete({
      where: { id: req.params.id }
    });
    res.status(200).json({ success: true, message: 'تم حذف الملزمة من المخزن بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف الملزمة' });
  }
});

apiRouter.post('/finance/collect', async (req, res) => {
  try {
    const { studentId, groupId, serviceId, bookletId, amount, paymentType, monthYear, secretaryName, quantity } = req.body;
    
    // Auto-Inventory POS integration
    if (bookletId) {
      const qty = parseInt(quantity) || 1;
      const booklet = await prisma.booklet.findUnique({ where: { id: bookletId } });
      
      if (!booklet || booklet.quantity < qty) {
        return res.status(400).json({ success: false, message: 'الكمية المطلوبة غير متوفرة في المخزن' });
      }
      
      await prisma.booklet.update({
        where: { id: bookletId },
        data: { quantity: { decrement: qty } }
      });
      
      await prisma.inventoryTransaction.create({
        data: {
          centerId: req.centerId,
          type: "SALE",
          bookletId: bookletId,
          studentId: studentId,
          quantityChanged: -qty,
          totalPrice: parseFloat(amount)
        }
      });
    }

    const payment = await prisma.studentFeePayment.create({
      data: {
        centerId: req.centerId,
        studentId: studentId || "",
        groupId: groupId || "",
        serviceId: serviceId || null,
        bookletId: bookletId || null,
        amount: parseFloat(amount),
        paymentType: paymentType, // "MONTHLY", "ADVANCE_MONTH", "TERM_RESERVATION", "NIGHT_REVIEW", "BOOKLET_ONLY"
        monthYear: monthYear || "",
        secretaryName: secretaryName || "System"
      }
    });

    res.status(200).json({ success: true, message: 'تم تحصيل الدفعة بنجاح', data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/finance/closing', async (req, res) => {
  try {
    const { managerPassword, monthYear } = req.body;
    
    if (!managerPassword || !monthYear) {
      return res.status(400).json({ success: false, message: 'كلمة مرور المدير والشهر مطلوبان' });
    }

    const center = await prisma.center.findUnique({ where: { id: req.centerId } });
    if (!center) return res.status(404).json({ success: false, message: 'السنتر غير موجود' });

    const isMatch = await bcrypt.compare(managerPassword, center.managerPasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'كلمة مرور المدير غير صحيحة' });
    }

    // Calculate revenue
    const payments = await prisma.studentFeePayment.findMany({
      where: { centerId: req.centerId, monthYear: monthYear }
    });
    
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalBookletSales = payments.filter(p => p.bookletId).reduce((sum, p) => sum + p.amount, 0);

    const closing = await prisma.monthlyClosing.create({
      data: {
        centerId: req.centerId,
        monthYear: monthYear,
        totalRevenue: totalRevenue,
        totalBookletSales: totalBookletSales,
        closedByManager: center.name
      }
    });

    res.status(200).json({ success: true, message: 'تم إغلاق الشهر بنجاح', data: closing });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api', apiRouter);

app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).sendFile(path.join(publicDir, 'login.html'));
  res.status(404).json({ success: false, message: 'المسار غير موجود' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;