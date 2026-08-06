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
