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

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static('public'));

// API Routes mounting
app.use('/api/super-admin', superadminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/inventory', posRoutes);
app.use('/api/pos', posRoutes); // Alias
app.use('/api/finance', financialsRoutes);
app.use('/api/financials', financialsRoutes); // Alias

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
