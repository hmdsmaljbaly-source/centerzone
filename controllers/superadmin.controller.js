const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'centerzone_saas_secret_key_2026';

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if superadmin exists, if not, create one for bootstrapping
    let superadmin = await prisma.superAdmin.findUnique({ where: { username } });
    if (!superadmin) {
      if (username === 'super_admin' && password === 'admin123') {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        superadmin = await prisma.superAdmin.create({
          data: { username: 'super_admin', email: 'admin@centerzone.com', password: hashedPassword }
        });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    const isValid = await bcrypt.compare(password, superadmin.password);
    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: superadmin.id, username: superadmin.username, role: 'SUPER_ADMIN' }, JWT_SECRET, { expiresIn: '24h' });
    res.status(200).json({ success: true, token, user: { username: superadmin.username, role: 'SUPER_ADMIN' } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

exports.getCenters = async (req, res) => {
  try {
    const centers = await prisma.center.findMany();
    res.status(200).json({ success: true, data: centers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch centers' });
  }
};

exports.createCenter = async (req, res) => {
  try {
    const { name, code, plan, maxStudentCodes } = req.body;
    const centerId = code || `center-${Math.floor(100 + Math.random() * 900)}`;
    const quota = parseInt(maxStudentCodes) || 500;

    const result = await prisma.$transaction(async (tx) => {
      const center = await tx.center.create({
        data: {
          name,
          centerId,
          code,
          plan: plan || 'ACTIVE',
          allowedStudentCodes: quota,
        }
      });
      return center;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Failed to create center' });
  }
};

exports.generatePrepaidCards = async (req, res) => {
  try {
    const { id } = req.params; // Center ID
    const { prefix, count } = req.body;
    const numCards = parseInt(count) || 100;

    const cardsToCreate = [];
    for (let i = 0; i < numCards; i++) {
      const code = `${prefix}_${Math.floor(100000 + Math.random() * 900000)}`;
      cardsToCreate.push({
        centerId: id,
        prefix,
        code,
        status: 'UNUSED'
      });
    }

    const created = await prisma.centerPrepaidCard.createMany({
      data: cardsToCreate,
      skipDuplicates: true
    });

    res.status(201).json({ success: true, message: `Generated ${created.count} cards successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate prepaid cards' });
  }
};

exports.generatePrepaidCodes = async (req, res) => {
  try {
    const { centerId, quantity, startIndex } = req.body;
    const numCards = parseInt(quantity);
    const startIdx = parseInt(startIndex);

    if (!centerId || isNaN(numCards) || isNaN(startIdx)) {
      return res.status(400).json({ success: false, message: 'بيانات غير مكتملة لتوليد الأكواد' });
    }

    const center = await prisma.center.findUnique({
      where: { id: centerId }
    });

    if (!center) {
      return res.status(404).json({ success: false, message: 'السنتر المحدد غير موجود' });
    }

    const generatedCount = await prisma.centerPrepaidCard.count({
      where: { centerId }
    });

    const limit = center.maxStudentCodes ?? 500;
    if (generatedCount + numCards > limit) {
      return res.status(400).json({ 
        success: false, 
        message: `لا يمكن التوليد: تجاوز الحصّة المحددة للسنتر (${limit}). تم توليد ${generatedCount} سابقاً، والمتاح حالياً هو ${limit - generatedCount} كود فقط.` 
      });
    }

    const cardsToCreate = [];
    const prefix = 'CENZ-';
    for (let i = 0; i < numCards; i++) {
      const code = `${prefix}${startIdx + i}`;
      cardsToCreate.push({
        centerId,
        prefix,
        code,
        status: 'UNUSED'
      });
    }

    const created = await prisma.centerPrepaidCard.createMany({
      data: cardsToCreate,
      skipDuplicates: true
    });

    res.status(201).json({ 
      success: true, 
      message: `تم توليد عدد ${created.count} كود بنجاح بالبادئة CENZ-`,
      data: { count: created.count }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to generate prepaid codes' });
  }
};

exports.getPrepaidCards = async (req, res) => {
  try {
    const { id } = req.params;
    const center = await prisma.center.findUnique({
      where: { id }
    });
    if (!center) {
      return res.status(404).json({ success: false, message: 'السنتر المحدد غير موجود' });
    }
    const cards = await prisma.centerPrepaidCard.findMany({
      where: { centerId: id },
      orderBy: { code: 'asc' }
    });
    res.status(200).json({ 
      success: true, 
      centerName: center.name, 
      maxStudentCodes: center.maxStudentCodes, 
      data: cards 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch prepaid cards' });
  }
};

exports.toggleCenterStatus = async (req, res) => {
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
};

exports.changeCenterPassword = async (req, res) => {
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
};

exports.deleteCenter = async (req, res) => {
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
};

exports.updateProfile = async (req, res) => {
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
};
