const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
const JWT_SECRET = process.env.JWT_SECRET || 'centerzone_saas_secret_key_2026';

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(path.resolve(__dirname, '../public')));
app.use(express.static(path.resolve('public')));

// Seeding Super Admin & Default Center for testing
async function seedSuperAdmin() {
  try {
    const defaultCenter = await prisma.center.findFirst({
      where: { OR: [{ id: 'center-101' }, { centerId: 'center-101' }, { code: 'center-101' }] }
    });
    if (!defaultCenter) {
      await prisma.center.create({
        data: {
          id: 'center-101',
          centerId: 'center-101',
          code: 'center-101',
          name: 'سنتر النخبة التعليمي',
          allowedStudentCodes: 1000
        }
      });
      console.log('✅ Default test center center-101 created');
    }

    const hashedPassword = await bcrypt.hash('gebo777', 10);
    const existingAdmin = await prisma.superAdmin.findFirst({
      where: {
        OR: [
          { username: 'admin' },
          { username: 'super_admain' },
          { email: 'admin@centerzone.com' },
          { email: 'superadmin@centerzone.com' }
        ]
      }
    });

    if (existingAdmin) {
      await prisma.superAdmin.update({
        where: { id: existingAdmin.id },
        data: {
          username: 'super_admain',
          email: 'superadmin@centerzone.com',
          password: hashedPassword,
          name: 'Super Admin'
        }
      });
      console.log('✅ Super Admin account updated to: super_admain / gebo777');
    } else {
      await prisma.superAdmin.create({
        data: {
          username: 'super_admain',
          email: 'superadmin@centerzone.com',
          password: hashedPassword,
          name: 'Super Admin'
        }
      });
      console.log('✅ Default Super Admin account seeded: super_admain / gebo777');
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error.message);
  }
}
seedSuperAdmin();

// HTML Routes Direct Mapping (Linux compatible)
app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../public/login.html')));
app.get('/login', (req, res) => res.sendFile(path.resolve(__dirname, '../public/login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/login.html')));

app.get('/dashboard', (req, res) => res.sendFile(path.resolve(__dirname, '../public/index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/index.html')));

app.get('/super-admin', (req, res) => res.sendFile(path.resolve(__dirname, '../public/super-admin.html')));
app.get('/super-admin.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/super-admin.html')));

app.get('/students.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/students.html')));
app.get('/teachers.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/teachers.html')));
app.get('/inventory.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/inventory.html')));
app.get('/scanner.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/scanner.html')));
app.get('/settings.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/settings.html')));
app.get('/financials', (req, res) => res.sendFile(path.resolve(__dirname, '../public/financials.html')));
app.get('/financials.html', (req, res) => res.sendFile(path.resolve(__dirname, '../public/financials.html')));

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'DOWN', database: 'DISCONNECTED', error: e.message });
  }
});

const apiRouter = express.Router();

// Auth Middleware for /api/* except /auth/login
apiRouter.use(async (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/login/') {
    return next();
  }
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (decoded.centerId) {
      req.centerId = decoded.centerId;
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
});

// Strict Multi-Tenancy Isolation Middleware
async function enforceTenantIsolation(req, res, next) {
  if (req.path === '/auth/login' || req.path === '/auth/login/' || req.path.startsWith('/super-admin') || req.path.startsWith('super-admin')) {
    return next();
  }

  const centerId = req.headers['x-center-id'] || (req.user && req.user.centerId);
  
  if (!centerId) {
    return res.status(400).json({ error: 'Missing tenant identifier (x-center-id header is required).', success: false });
  }

  // Verify tenant exists in Database
  let tenant = await prisma.center.findUnique({ where: { id: centerId } }).catch(() => null);
  if (!tenant) {
    tenant = await prisma.center.findFirst({
      where: {
        OR: [
          { centerId: centerId },
          { code: centerId }
        ]
      }
    }).catch(() => null);
  }

  if (!tenant) {
    return res.status(404).json({ error: 'Invalid Center ID. Tenant does not exist in database.', success: false });
  }

  // Attach validated tenant object to request context
  req.tenantId = tenant.id;
  req.centerId = tenant.id;
  req.tenant = tenant;
  next();
}
apiRouter.use(enforceTenantIsolation);

// Authentication Endpoint
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 1. Check SuperAdmin
    const superAdmin = await prisma.superAdmin.findFirst({
      where: { OR: [{ username: username }, { email: username }] }
    });
    if (superAdmin) {
      const isMatch = await bcrypt.compare(password, superAdmin.password).catch(() => superAdmin.password === password);
      if (isMatch || superAdmin.password === password) {
        const token = jwt.sign({ id: superAdmin.id, username: superAdmin.username, role: 'SUPER_ADMIN' }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({
          success: true,
          userRole: 'SUPER_ADMIN',
          token,
          redirectUrl: '/super-admin.html',
          message: 'تم تسجيل الدخول بنجاح كـ Super Admin',
          data: {
            token,
            userRole: 'SUPER_ADMIN',
            centerId: '',
            redirectUrl: '/super-admin.html'
          }
        });
      }
    }

    // 2. Check Center Users
    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.password).catch(() => user.password === password);
      if (isPasswordValid || user.password === password) {
        let targetCenterId = user.centerId || 'center-101';
        if (user.centerId) {
          const c = await prisma.center.findUnique({ where: { id: user.centerId } }).catch(() => null);
          if (c && c.centerId) targetCenterId = c.centerId;
        }
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'CENTER_ADMIN', centerId: targetCenterId }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          data: {
            token,
            userRole: user.role || 'CENTER_ADMIN',
            centerId: targetCenterId
          }
        });
      }
    }

    // 3. Check Center direct login (by code or centerId or email)
    const center = await prisma.center.findFirst({
      where: { OR: [{ code: username }, { centerId: username }, { email: username }] }
    });
    if (center && center.password_hash) {
      const isMatch = await bcrypt.compare(password, center.password_hash).catch(() => center.password_hash === password);
      if (isMatch || center.password_hash === password) {
        const token = jwt.sign({ id: center.id, username: center.centerId, role: 'CENTER_ADMIN', centerId: center.centerId }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          data: {
            token,
            userRole: 'CENTER_ADMIN',
            centerId: center.centerId || 'center-101'
          }
        });
      }
    }

    return res.status(401).json({ success: false, message: 'Unauthorized' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Super Admin Management
apiRouter.get('/super-admin/centers', async (req, res) => {
  try {
    const centers = await prisma.center.findMany({
      include: {
        users: { select: { username: true } },
        _count: { select: { students: true, teachers: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, count: centers.length, data: centers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/super-admin/centers', async (req, res) => {
  try {
    const { name, code, centerId, plan, expiresAt, expiry, phone, username, password, adminUsername, adminPassword, maxStudentCodes, allowedStudentCodes, managerPassword } = req.body;
    const plainPassword = adminPassword || password || '123456';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const mngrPassword = managerPassword || '123456';
    const managerPasswordHash = await bcrypt.hash(mngrPassword, 10);
    const finalCode = code || centerId || `CODE-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalCenterId = centerId || code || `center-${Math.floor(100 + Math.random() * 900)}`;
    const finalUsername = adminUsername || username || finalCenterId;
    const quota = parseInt(maxStudentCodes) || parseInt(allowedStudentCodes) || 500;
    const finalExpiry = expiresAt || expiry || '2026-12-31';

    const result = await prisma.$transaction(async (tx) => {
      const center = await tx.center.create({
        data: {
          name: name || 'السنتر التعليمي',
          centerId: finalCenterId,
          code: finalCode,
          plan: plan || 'ACTIVE',
          isActive: true,
          phone: phone || null,
          email: `${finalUsername}_${Date.now()}@saas-center.com`,
          password_hash: hashedPassword,
          subscription_status: plan === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
          expiresAt: new Date(finalExpiry),
          expires_at: new Date(finalExpiry),
          allowedStudentCodes: quota,
          managerPasswordHash
        }
      });

      const user = await tx.user.create({
        data: {
          username: finalUsername,
          password: hashedPassword,
          role: 'CENTER_ADMIN',
          centerId: center.id
        }
      });

      return { center, user };
    });

    res.status(201).json({ success: true, message: 'تم إنشاء السنتر وتكاويد حساب المدير بنجاح', data: result.center, user: { username: result.user.username } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'فشل إنشاء السنتر' });
  }
});

apiRouter.patch('/super-admin/centers/:idOrCode/status', async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const center = await prisma.center.findFirst({
      where: { OR: [{ centerId: idOrCode }, { id: idOrCode }, { code: idOrCode }] }
    });
    if (!center) {
      return res.status(404).json({ success: false, message: 'السنتر غير موجود' });
    }
    const newIsActive = !center.isActive;
    const updated = await prisma.center.update({
      where: { id: center.id },
      data: {
        isActive: newIsActive,
        subscription_status: newIsActive ? 'ACTIVE' : 'SUSPENDED'
      }
    });
    res.status(200).json({ success: true, message: `تم تعديل حالة السنتر إلى ${updated.isActive ? 'نشط' : 'موقوف'}`, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.put('/super-admin/centers/:idOrCode/password', async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const { newPassword, adminPassword, password } = req.body;
    const targetPassword = newPassword || adminPassword || password;
    if (!targetPassword) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور الجديدة' });
    }
    const center = await prisma.center.findFirst({
      where: { OR: [{ centerId: idOrCode }, { id: idOrCode }, { code: idOrCode }] },
      include: { users: true }
    });
    if (!center) {
      return res.status(404).json({ success: false, message: 'السنتر غير موجود' });
    }
    const hashedPassword = await bcrypt.hash(targetPassword, 10);
    await prisma.center.update({
      where: { id: center.id },
      data: { password_hash: hashedPassword }
    });
    if (center.users && center.users.length > 0) {
      await prisma.user.updateMany({
        where: { centerId: center.id },
        data: { password: hashedPassword }
      });
    }
    res.status(200).json({ success: true, message: 'تم تغيير كلمة مرور مدير السنتر بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.delete('/super-admin/centers/:idOrCode', async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const center = await prisma.center.findFirst({
      where: { OR: [{ centerId: idOrCode }, { id: idOrCode }, { code: idOrCode }] }
    });
    if (!center) {
      return res.status(404).json({ success: false, message: 'السنتر غير موجود' });
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { OR: [{ centerId: center.id }, { centerId: center.centerId }] } });
      await tx.center.delete({ where: { id: center.id } });
    });
    res.status(200).json({ success: true, message: 'تم حذف السنتر وجميع بياناته المربوطة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.put('/super-admin/profile', async (req, res) => {
  try {
    const { currentPassword, newPassword, newUsername, newEmail } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور الحالية للتأكيد' });
    }
    let admin = null;
    if (req.user && req.user.id) {
      admin = await prisma.superAdmin.findFirst({ where: { OR: [{ id: req.user.id }, { username: req.user.username }] } });
    }
    if (!admin) {
      admin = await prisma.superAdmin.findFirst();
    }
    if (!admin) {
      return res.status(404).json({ success: false, message: 'حساب السوبر أدمن غير موجود' });
    }
    const isMatch = await bcrypt.compare(currentPassword, admin.password).catch(() => admin.password === currentPassword);
    if (!isMatch && admin.password !== currentPassword) {
      return res.status(401).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }
    const updateData = {};
    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }
    if (newUsername) {
      updateData.username = newUsername;
    }
    if (newEmail) {
      updateData.email = newEmail;
    }
    const updatedAdmin = await prisma.superAdmin.update({
      where: { id: admin.id },
      data: updateData
    });
    res.status(200).json({ success: true, message: 'تم تحديث إعدادات حساب السوبر أدمن بنجاح', data: { username: updatedAdmin.username, email: updatedAdmin.email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Students API Endpoints
apiRouter.get('/students', async (req, res) => {
  try {
    const { alert_status, teacherId, subject, groupId, grade, status, search } = req.query;

    const students = await prisma.student.findMany({
      where: { centerId: req.tenantId },
      include: {
        group: { include: { teacher: true } },
        enrollments: { include: { group: true, teacher: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let formatted = students.map(s => {
      const allGroups = [];
      const allTeachers = [];
      const allSubjects = new Set();

      if (s.group) {
        allGroups.push({ id: s.group.id, name: s.group.name, grade: s.group.grade || '', time: `${s.group.dayOfWeek} ${s.group.startTime}` });
        if (s.group.teacher) {
          allTeachers.push({ id: s.group.teacher.id, name: s.group.teacher.name, subject: s.group.teacher.subject });
          allSubjects.add(s.group.teacher.subject);
        }
      }

      if (s.enrollments && s.enrollments.length > 0) {
        s.enrollments.forEach(en => {
          if (en.group && !allGroups.some(g => g.id === en.group.id)) {
            allGroups.push({ id: en.group.id, name: en.group.name, grade: en.group.grade || '', time: `${en.group.dayOfWeek} ${en.group.startTime}` });
          }
          if (en.teacher && !allTeachers.some(t => t.id === en.teacher.id)) {
            allTeachers.push({ id: en.teacher.id, name: en.teacher.name, subject: en.teacher.subject });
            allSubjects.add(en.teacher.subject);
          }
        });
      }

      let statusLabel = 'NORMAL';
      if (s.isBlocked || (s.alert_note && s.alert_note.includes('محظور'))) statusLabel = 'BLOCKED';
      else if (s.hasFinancialWarning || s.alert_status) statusLabel = 'WARNING';

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        grade: s.grade || (allGroups[0] && allGroups[0].grade ? allGroups[0].grade : 'الصف الأول الثانوي'),
        student_phone: s.student_phone || '',
        parent_phone: s.parent_phone,
        alert_status: statusLabel,
        alert_note: s.alert_note || '',
        barcode: s.barcode || s.code,
        createdAt: s.createdAt,
        groups: allGroups,
        teachers: allTeachers,
        subjects: Array.from(allSubjects)
      };
    });

    // 5-Tier filtering logic
    const effStatus = status || alert_status;
    if (teacherId && teacherId !== 'ALL') {
      formatted = formatted.filter(s => s.teachers.some(t => t.id === teacherId));
    }
    if (subject && subject !== 'ALL') {
      formatted = formatted.filter(s => s.subjects.some(sub => sub === subject || sub.toLowerCase().includes(subject.toLowerCase())));
    }
    if (groupId && groupId !== 'ALL') {
      formatted = formatted.filter(s => s.groups.some(g => g.id === groupId));
    }
    if (grade && grade !== 'ALL') {
      formatted = formatted.filter(s => s.grade === grade || s.groups.some(g => g.grade === grade));
    }
    if (effStatus && effStatus !== 'ALL') {
      formatted = formatted.filter(s => s.alert_status === effStatus);
    }
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      formatted = formatted.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.student_phone && s.student_phone.includes(q)) ||
        (s.parent_phone && s.parent_phone.includes(q))
      );
    }

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/students', async (req, res) => {
  try {
    const { 
      name, 
      phone, student_phone, 
      parentPhone, parent_phone, 
      notes, alert_note, 
      alert_status, 
      grade, 
      groupId, 
      teacherId,
      studentCode, code,
      barcode: paramBarcode
    } = req.body;

    const finalStudentPhone = phone || student_phone || null;
    const finalParentPhone = parentPhone || parent_phone;
    const finalNote = notes || alert_note || null;
    const finalGroupId = (groupId && groupId !== 'ALL' && groupId !== '') ? groupId : null;
    const finalTeacherId = (teacherId && teacherId !== 'ALL' && teacherId !== '') ? teacherId : null;

    if (!name || !finalParentPhone) {
      return res.status(400).json({ success: false, message: 'اسم الطالب ورقم ولي الأمر مطلوبان' });
    }

    const center = await prisma.center.findFirst({
      where: {
        OR: [
          { id: req.tenantId },
          { centerId: req.tenantId },
          { code: req.tenantId }
        ]
      }
    });

    const usedStudentCodes = (center && center.usedStudentCodes !== undefined && center.usedStudentCodes !== null) ? center.usedStudentCodes : 0;
    const allowedStudentCodes = (center && center.allowedStudentCodes !== undefined && center.allowedStudentCodes !== null) ? center.allowedStudentCodes : 0;

    if (center && allowedStudentCodes > 0 && usedStudentCodes >= allowedStudentCodes) {
      return res.status(403).json({ success: false, error: 'استنفذت باقة الأكواد المتاحة للسنتر. يرجى التواصل مع الإدارة', message: 'استنفذت باقة الأكواد المتاحة للسنتر. يرجى التواصل مع الإدارة' });
    }

    let finalCode = studentCode || code;
    if (!finalCode || finalCode.trim() === '') {
      const existingCount = await prisma.student.count({ where: { centerId: req.tenantId } });
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      finalCode = `STU-${existingCount + 1}-${randomDigits}`;
    }
    const finalBarcode = paramBarcode || finalCode;

    let group = null;
    if (finalGroupId) {
      group = await prisma.group.findFirst({
        where: { id: finalGroupId, centerId: req.tenantId }
      });
    }

    const student = await prisma.student.create({
      data: {
        centerId: req.tenantId,
        code: finalCode,
        barcode: finalBarcode,
        name: name.trim(),
        grade: grade || (group && group.grade ? group.grade : 'الصف الأول الثانوي'),
        student_phone: finalStudentPhone,
        parent_phone: finalParentPhone.trim(),
        alert_status: alert_status === 'WARNING' || alert_status === 'BLOCKED',
        alert_note: finalNote,
        isBlocked: alert_status === 'BLOCKED',
        hasFinancialWarning: alert_status === 'WARNING',
        groupId: group ? group.id : null
      }
    });

    if (finalGroupId && group) {
      await prisma.studentEnrollment.create({
        data: {
          centerId: req.tenantId,
          studentId: student.id,
          groupId: group.id,
          teacherId: finalTeacherId || group.teacherId || null
        }
      });
    }

    if (center && center.id) {
      await prisma.center.update({
        where: { id: center.id },
        data: { usedStudentCodes: { increment: 1 } }
      });
    }

    res.status(201).json({
      success: true,
      message: 'تم إضافة الطالب بنجاح وتوليد الكود والباركوود',
      data: {
        id: student.id,
        code: student.code,
        barcode: student.barcode,
        name: student.name,
        grade: student.grade,
        parent_phone: student.parent_phone,
        student_phone: student.student_phone,
        alert_status: student.alert_status ? 'WARNING' : 'NORMAL',
        alert_note: student.alert_note,
        groupId: student.groupId,
        teacherId: finalTeacherId || (group ? group.teacherId : null)
      }
    });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/students/:id/profile', async (req, res) => {
  try {
    const studentId = req.params.id;
    const centerId = req.tenantId;
    
    const student = await prisma.student.findFirst({
      where: { id: studentId, centerId: centerId },
      include: {
        group: { include: { teacher: true, hall: true } },
        enrollments: { include: { group: { include: { hall: true } }, teacher: true } },
        attendances: { include: { group: true }, orderBy: { date: 'desc' }, take: 50 },
        grades: { include: { evaluation: { include: { group: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود أو لا ينتمي لهذا السنتر' });
    }

    const [feePayments, serviceSales] = await Promise.all([
      prisma.studentFeePayment.findMany({ where: { studentId: student.id, centerId: centerId }, orderBy: { createdAt: 'desc' } }),
      prisma.serviceSale.findMany({ where: { student_id: student.id, center_id: centerId }, include: { service: true }, orderBy: { date: 'desc' } })
    ]);

    // Enrolled Teachers & Groups
    const enrolledMap = new Map();
    if (student.group && student.group.teacher) {
      enrolledMap.set(`${student.group.id}-${student.group.teacher.id}`, {
        groupId: student.group.id,
        groupName: student.group.name,
        schedule: `${student.group.dayOfWeek} (${student.group.startTime} - ${student.group.endTime})`,
        hallName: student.group.hall ? student.group.hall.name : 'قاعة رئيسية',
        teacherId: student.group.teacher.id,
        teacherName: student.group.teacher.name,
        subject: student.group.teacher.subject,
        monthlyPrice: student.group.price || 0
      });
    }
    if (student.enrollments) {
      student.enrollments.forEach(en => {
        if (en.group && en.teacher) {
          const key = `${en.group.id}-${en.teacher.id}`;
          if (!enrolledMap.has(key)) {
            enrolledMap.set(key, {
              groupId: en.group.id,
              groupName: en.group.name,
              schedule: `${en.group.dayOfWeek} (${en.group.startTime} - ${en.group.endTime})`,
              hallName: en.group.hall ? en.group.hall.name : 'قاعة رئيسية',
              teacherId: en.teacher.id,
              teacherName: en.teacher.name,
              subject: en.teacher.subject,
              monthlyPrice: en.group.price || 0
            });
          }
        }
      });
    }
    const enrollmentsList = Array.from(enrolledMap.values());

    // Financial Ledger per Teacher/Group
    const financialLedger = enrollmentsList.map(en => {
      const groupPayments = feePayments.filter(p => p.groupId === en.groupId);
      const totalPaid = groupPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const lastPayment = groupPayments[0];
      let status = 'UNPAID';
      if (lastPayment && (lastPayment.paymentType === 'MONTHLY' || lastPayment.paymentType === 'ADVANCE_MONTH' || totalPaid >= en.monthlyPrice)) {
        status = 'PAID';
      } else if (totalPaid > 0) {
        status = 'PARTIAL';
      }
      
      return {
        teacherName: en.teacherName,
        subject: en.subject,
        groupName: en.groupName,
        monthlyPrice: en.monthlyPrice,
        totalPaid: Number(totalPaid.toFixed(2)),
        lastPaymentDate: lastPayment ? lastPayment.createdAt : null,
        lastPaymentType: lastPayment ? lastPayment.paymentType : 'بدون',
        paymentStatus: status,
        history: groupPayments.map(gp => ({
          id: gp.id,
          amount: gp.amount,
          monthYear: gp.monthYear || 'الشهر الحالي',
          paymentType: gp.paymentType,
          date: gp.createdAt,
          secretaryName: gp.secretaryName || 'الأدمين'
        }))
      };
    });

    const generalPurchases = serviceSales.map(s => ({
      id: s.id,
      title: s.service ? s.service.title : 'شراء مذكرة أو أونلاين',
      amount: parseFloat(s.amount_paid) || 0,
      date: s.date
    }));

    const attendanceHistory = (student.attendances || []).map(a => ({
      id: a.id,
      groupName: a.group ? a.group.name : 'مجموعة عامة',
      date: a.date,
      status: a.status
    }));

    const examResults = (student.grades || []).map(g => ({
      id: g.id,
      examTitle: g.evaluation ? g.evaluation.title : 'اختبار قصير',
      examType: g.evaluation ? g.evaluation.type : 'EXAM',
      score: g.score,
      maxScore: g.evaluation ? g.evaluation.max_score : 100,
      groupName: g.evaluation && g.evaluation.group ? g.evaluation.group.name : 'مجموعة عامة',
      date: g.createdAt
    }));

    let statusLabel = 'NORMAL';
    if (student.isBlocked || (student.alert_note && student.alert_note.includes('محظور'))) statusLabel = 'BLOCKED';
    else if (student.hasFinancialWarning || student.alert_status) statusLabel = 'WARNING';

    res.status(200).json({
      success: true,
      data: {
        personalInfo: {
          id: student.id,
          code: student.code,
          barcode: student.barcode || student.code,
          name: student.name,
          grade: student.grade || (enrollmentsList[0] && enrollmentsList[0].groupName ? enrollmentsList[0].groupName : 'الصف الأول الثانوي'),
          studentPhone: student.student_phone || 'غير مسجل',
          parentPhone: student.parent_phone,
          status: statusLabel,
          alertNote: student.alert_note || '',
          createdAt: student.createdAt
        },
        enrollments: enrollmentsList,
        financialLedger: financialLedger,
        generalPurchases: generalPurchases,
        attendanceHistory: attendanceHistory,
        examResults: examResults
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
      where: { centerId: req.tenantId, OR: [{ code: code }, { id: code }] }
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
          centerId: req.tenantId,
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
apiRouter.get('/groups', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { centerId: req.tenantId },
      include: { teacher: true, hall: true }
    });
    res.status(200).json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.get('/groups/today', async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { centerId: req.tenantId },
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
          centerId: req.tenantId,
          hallId: hall_id,
          dayOfWeek: dayOfWeek
        }
      });
      
      const isConflict = existingGroups.some(g => {
        return (startTime < g.endTime && endTime > g.startTime);
      });

      if (isConflict) {
        return res.status(409).json({ success: false, message: 'يوجد تعارض في الجدول مع مجموعة أخرى في نفس القاعة والتوقيت' });
      }
    }

    const group = await prisma.group.create({
      data: {
        centerId: req.tenantId,
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
      where: { center_id: req.tenantId },
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
        center_id: req.tenantId,
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

// Exams / Evaluations Endpoints
apiRouter.get('/exams', async (req, res) => {
  try {
    const exams = await prisma.evaluation.findMany({
      where: { centerId: req.tenantId },
      include: { group: true }
    });
    res.status(200).json({ success: true, count: exams.length, data: exams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/exams', async (req, res) => {
  try {
    const { group_id, title, type, max_score, date } = req.body;
    if (!group_id || !title) {
      return res.status(400).json({ success: false, message: 'المجموعة وعنوان الاختبار مطلوبان' });
    }
    const group = await prisma.group.findFirst({ where: { id: group_id, centerId: req.tenantId } });
    if (!group) return res.status(404).json({ success: false, message: 'المجموعة غير موجودة بهذا السنتر' });

    const exam = await prisma.evaluation.create({
      data: {
        centerId: req.tenantId,
        group_id: group.id,
        title: title.trim(),
        type: type || 'EXAM',
        max_score: parseFloat(max_score) || 100.0,
        date: date ? new Date(date) : new Date()
      }
    });
    res.status(201).json({ success: true, message: 'تم إنشاء الاختبار بنجاح', data: exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Inventory POS Endpoints
apiRouter.get('/inventory', async (req, res) => {
  try {
    const booklets = await prisma.booklet.findMany({
      where: { centerId: req.tenantId },
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
        centerId: req.tenantId,
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
    const booklet = await prisma.booklet.findFirst({
      where: { id: req.params.id, centerId: req.tenantId }
    });
    if (!booklet) return res.status(404).json({ success: false, message: 'الملزمة غير موجودة بهذا السنتر' });

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
      const booklet = await prisma.booklet.findFirst({ where: { id: bookletId, centerId: req.tenantId } });
      
      if (!booklet || booklet.quantity < qty) {
        return res.status(400).json({ success: false, message: 'الكمية المطلوبة غير متوفرة في المخزن أو لا تخص هذا السنتر' });
      }
      
      await prisma.booklet.update({
        where: { id: bookletId },
        data: { quantity: { decrement: qty } }
      });
      
      await prisma.inventoryTransaction.create({
        data: {
          centerId: req.tenantId,
          type: "SALE",
          bookletId: bookletId,
          studentId: studentId || "",
          quantityChanged: -qty,
          totalPrice: parseFloat(amount)
        }
      });
    }

    const payment = await prisma.studentFeePayment.create({
      data: {
        centerId: req.tenantId,
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

    const center = req.tenant || await prisma.center.findUnique({ where: { id: req.tenantId } });
    if (!center) return res.status(404).json({ success: false, message: 'السنتر غير موجود' });

    const isMatch = await bcrypt.compare(managerPassword, center.managerPasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'كلمة مرور المدير غير صحيحة' });
    }

    // Calculate revenue
    const payments = await prisma.studentFeePayment.findMany({
      where: { centerId: req.tenantId, monthYear: monthYear }
    });
    
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalBookletSales = payments.filter(p => p.bookletId).reduce((sum, p) => sum + p.amount, 0);

    const closing = await prisma.monthlyClosing.create({
      data: {
        centerId: req.tenantId,
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

// ==========================================
// Financials & Accounting Live DB Endpoints
// ==========================================
async function resolveCenterIds(req) {
  if (req.tenantId && req.tenant) {
    const ids = [req.tenant.id];
    if (req.tenant.centerId && !ids.includes(req.tenant.centerId)) ids.push(req.tenant.centerId);
    if (req.tenant.code && !ids.includes(req.tenant.code)) ids.push(req.tenant.code);
    return { dbId: req.tenantId, allIds: ids };
  }
  const rawId = req.tenantId || req.headers['x-center-id'] || req.centerId || (req.user && req.user.centerId);
  if (!rawId) throw new Error('مُعرف السنتر مطلوب في ترويسة الطلب (x-center-id)');
  const center = await prisma.center.findFirst({
    where: { OR: [{ centerId: rawId }, { id: rawId }, { code: rawId }] }
  });
  const ids = [rawId];
  if (center) {
    if (center.id && !ids.includes(center.id)) ids.push(center.id);
    if (center.centerId && !ids.includes(center.centerId)) ids.push(center.centerId);
    if (center.code && !ids.includes(center.code)) ids.push(center.code);
  }
  return { dbId: center ? center.id : rawId, allIds: ids };
}

apiRouter.get('/financials/summary', async (req, res) => {
  try {
    const { allIds } = await resolveCenterIds(req);

    // 1. Gross Revenue (StudentFeePayment + ServiceSale)
    const [feePayments, serviceSales, expenses, teachers] = await Promise.all([
      prisma.studentFeePayment.findMany({ where: { centerId: { in: allIds } } }),
      prisma.serviceSale.findMany({ where: { center_id: { in: allIds } } }),
      prisma.expense.findMany({ where: { centerId: { in: allIds } } }),
      prisma.teacher.findMany({
        where: { center_id: { in: allIds } },
        include: { groups: true, services: true, payouts: true }
      })
    ]);

    const feeRevenue = feePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const serviceRevenue = serviceSales.reduce((sum, s) => sum + (parseFloat(s.amount_paid) || 0), 0);
    const grossRevenue = feeRevenue + serviceRevenue;

    // 2. Operational Expenses
    const operationalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // 3. Teachers Breakdown for share and unsettled balance
    let totalTeacherShare = 0;
    let unsettledTeacherBalances = 0;

    for (const t of teachers) {
      const groupIds = (t.groups || []).map(g => g.id);
      const serviceIds = (t.services || []).map(s => s.id);
      
      const tFeeRev = feePayments.filter(p => groupIds.includes(p.groupId)).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const tServRev = serviceSales.filter(s => serviceIds.includes(s.service_id)).reduce((s, x) => s + (parseFloat(x.amount_paid) || 0), 0);
      const tTotalCol = tFeeRev + tServRev;

      const split = t.centerPercentage != null ? parseFloat(t.centerPercentage) : 30.0;
      const teacherPercent = 100.0 - split;
      const teacherShare = tTotalCol * (teacherPercent / 100.0);
      totalTeacherShare += teacherShare;

      const tPaidOut = (t.payouts || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      const remain = teacherShare - tPaidOut;
      if (remain > 0) unsettledTeacherBalances += remain;
    }

    // 4. Center Net Profit = (Gross Revenue - Total Teacher Share) - Operational Expenses
    const centerNetProfit = (grossRevenue - totalTeacherShare) - operationalExpenses;

    res.status(200).json({
      success: true,
      data: {
        grossRevenue: Number(grossRevenue.toFixed(2)),
        operationalExpenses: Number(operationalExpenses.toFixed(2)),
        centerNetProfit: Number(centerNetProfit.toFixed(2)),
        unsettledTeacherBalances: Number(unsettledTeacherBalances.toFixed(2))
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

apiRouter.get('/financials/teachers-breakdown', async (req, res) => {
  try {
    const { allIds } = await resolveCenterIds(req);
    const teachers = await prisma.teacher.findMany({
      where: { center_id: { in: allIds } },
      include: { groups: true, services: true, payouts: true }
    });

    const [feePayments, serviceSales] = await Promise.all([
      prisma.studentFeePayment.findMany({ where: { centerId: { in: allIds } } }),
      prisma.serviceSale.findMany({ where: { center_id: { in: allIds } } })
    ]);

    const breakdown = teachers.map(t => {
      const groupIds = (t.groups || []).map(g => g.id);
      const serviceIds = (t.services || []).map(s => s.id);

      const tFees = feePayments.filter(p => groupIds.includes(p.groupId));
      const tServs = serviceSales.filter(s => serviceIds.includes(s.service_id));

      const paidStudentsCount = tFees.length + tServs.length;
      const totalCollected = tFees.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) + tServs.reduce((s, x) => s + (parseFloat(x.amount_paid) || 0), 0);

      const centerPercentage = t.centerPercentage != null ? parseFloat(t.centerPercentage) : 30.0;
      const teacherPercentage = 100.0 - centerPercentage;

      const centerShare = totalCollected * (centerPercentage / 100.0);
      const teacherShare = totalCollected * (teacherPercentage / 100.0);
      const totalPaidOut = (t.payouts || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      const remainingBalance = teacherShare - totalPaidOut;

      return {
        id: t.id,
        name: t.name,
        subject: t.subject || 'عام',
        phone: t.phone || '',
        centerPercentage,
        teacherPercentage,
        paidStudentsCount,
        totalCollected: Number(totalCollected.toFixed(2)),
        centerShare: Number(centerShare.toFixed(2)),
        teacherShare: Number(teacherShare.toFixed(2)),
        totalPaidOut: Number(totalPaidOut.toFixed(2)),
        remainingBalance: Number(remainingBalance.toFixed(2))
      };
    });

    res.status(200).json({ success: true, data: breakdown });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

apiRouter.post('/financials/expenses', async (req, res) => {
  try {
    const { title, category, amount } = req.body;
    if (!title || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان المصروف ومقدار مالي صحيح' });
    }
    const expense = await prisma.expense.create({
      data: {
        centerId: req.tenantId,
        title: title.trim(),
        category: category || 'أخرى',
        amount: parseFloat(amount)
      }
    });
    res.status(201).json({ success: true, message: 'تم تسجيل المصروف التشغيلي بنجاح', data: expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

apiRouter.get('/financials/expenses', async (req, res) => {
  try {
    const { allIds } = await resolveCenterIds(req);
    const expenses = await prisma.expense.findMany({
      where: { centerId: { in: allIds } },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: expenses });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

apiRouter.post('/financials/payouts', async (req, res) => {
  try {
    const { teacherId, amount, notes } = req.body;
    if (!teacherId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'بيانات التسوية غير مكتملة أو المبلغ غير صحيح' });
    }
    const payout = await prisma.teacherPayout.create({
      data: {
        centerId: req.tenantId,
        teacherId,
        amount: parseFloat(amount),
        notes: notes || 'تسوية مستحقات مالية'
      }
    });
    res.status(201).json({ success: true, message: 'تم تسديد الدفعة للمدرس بنجاح', data: payout });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

apiRouter.get('/financials/audit-stream', async (req, res) => {
  try {
    const { allIds } = await resolveCenterIds(req);
    const [feePayments, serviceSales, expenses, payouts] = await Promise.all([
      prisma.studentFeePayment.findMany({ where: { centerId: { in: allIds } }, take: 30, orderBy: { createdAt: 'desc' } }),
      prisma.serviceSale.findMany({ where: { center_id: { in: allIds } }, take: 30, orderBy: { createdAt: 'desc' }, include: { service: true } }),
      prisma.expense.findMany({ where: { centerId: { in: allIds } }, take: 30, orderBy: { createdAt: 'desc' } }),
      prisma.teacherPayout.findMany({ where: { centerId: { in: allIds } }, take: 30, orderBy: { createdAt: 'desc' }, include: { teacher: { select: { name: true } } } })
    ]);

    const stream = [
      ...feePayments.map(p => ({
        id: 'FEE-' + p.id,
        title: `تحصيل رسوم طالب (${p.paymentType}) - بواسطة ${p.secretaryName || 'الأدمين'}`,
        amount: parseFloat(p.amount) || 0,
        type: 'INCOME',
        date: p.createdAt
      })),
      ...serviceSales.map(s => ({
        id: 'SRV-' + s.id,
        title: `مبيعات أونلاين/مذكرات: ${s.service ? s.service.title : 'خدمة مدرس'}`,
        amount: parseFloat(s.amount_paid) || 0,
        type: 'INCOME',
        date: s.createdAt
      })),
      ...expenses.map(e => ({
        id: 'EXP-' + e.id,
        title: `مصروف تشغيلي (${e.category}): ${e.title}`,
        amount: -(parseFloat(e.amount) || 0),
        type: 'EXPENSE',
        date: e.createdAt
      })),
      ...payouts.map(x => ({
        id: 'PYT-' + x.id,
        title: `تسوية مالية للمدرس (${x.teacher ? x.teacher.name : ''}): ${x.notes || 'دفعة نقدية'}`,
        amount: -(parseFloat(x.amount) || 0),
        type: 'PAYOUT',
        date: x.createdAt
      }))
    ];

    stream.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({ success: true, data: stream.slice(0, 50) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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