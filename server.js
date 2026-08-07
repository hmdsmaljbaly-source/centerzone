const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const prisma = require('./config/prisma');

// Import Routers
const superadminRoutes = require('./routes/superadmin.routes');
const studentRoutes = require('./routes/student.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const posRoutes = require('./routes/pos.routes');
const financialsRoutes = require('./routes/financials.routes');
const groupRoutes = require('./routes/group.routes');
const teacherRoutes = require('./routes/teacher.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Global Middlewares
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('public'));

const path = require('path');
const bcrypt = require('bcryptjs');

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

// HTML Routes Direct Mapping
app.get('/', (req, res) => res.sendFile(path.resolve(__dirname, 'public/login.html')));
app.get('/login', (req, res) => res.sendFile(path.resolve(__dirname, 'public/login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/login.html')));

app.get('/dashboard', (req, res) => res.sendFile(path.resolve(__dirname, 'public/index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/index.html')));

app.get('/super-admin', (req, res) => res.sendFile(path.resolve(__dirname, 'public/super-admin.html')));
app.get('/super-admin.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/super-admin.html')));

app.get('/center-profile', (req, res) => res.sendFile(path.resolve(__dirname, 'public/center-profile.html')));
app.get('/center-profile.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/center-profile.html')));

app.get('/students.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/students.html')));
app.get('/teachers.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/teachers.html')));
app.get('/inventory.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/inventory.html')));
app.get('/scanner.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/scanner.html')));
app.get('/settings.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/settings.html')));
app.get('/financials', (req, res) => res.sendFile(path.resolve(__dirname, 'public/financials.html')));
app.get('/financials.html', (req, res) => res.sendFile(path.resolve(__dirname, 'public/financials.html')));

// API Routes mounting
app.use('/api/super-admin', superadminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/inventory', posRoutes);
app.use('/api/pos', posRoutes); // Alias
app.use('/api/finance', financialsRoutes);
app.use('/api/financials', financialsRoutes); // Alias
app.use('/api/halls', require('./routes/hall.routes'));

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 CenterZone SaaS Backend Server is running on http://${HOST}:${PORT}`);
});

const gracefulShutdown = async () => {
  console.log('\n⏳ Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Prisma disconnected and server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;
