const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'centerzone_saas_secret_key_2026';

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(401).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
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
        let targetCenterId = user.centerId || '';
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
            centerId: center.centerId || center.id || ''
          }
        });
      }
    }

    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة السر غير صحيحة' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء عملية تسجيل الدخول' });
  }
};
