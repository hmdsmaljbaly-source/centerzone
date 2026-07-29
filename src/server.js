const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const prisma = require('./config/prisma');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware الأساسية للأمان والأداء
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// فحص سلامة التطبيق (Health Check Endpoint)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'UP', database: 'CONNECTED', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', database: 'DISCONNECTED', error: error.message });
  }
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Center SaaS Backend Server is running on port ${PORT}`);
});
