const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const prisma = require('./config/prisma');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // مهم جداً ليعمل السيرفر بشكل صحيح على منصات مثل Railway

// Middleware الأساسية للأمان والأداء
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// توجيه تلقائي عند فتح رابط السيرفر الرئيسي إلى صفحة/مسار تسجيل الدخول
app.get('/', (req, res) => {
  res.redirect('/api/auth/login'); // يوجه الزائر تلقائيًا إلى مسار تسجيل الدخول
});

// فحص سلامة التطبيق (Health Check Endpoint)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ 
      status: 'UP', 
      database: 'CONNECTED', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'DOWN', 
      database: 'DISCONNECTED', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Database Connection Failed' 
    });
  }
});

// المسار الافتراضي للـ Routes الغير موجودة (404 Handler)
app.use((req, res) => {
  res.status(404).json({ message: 'Route Not Found' });
});

// معالج الأخطاء العام (Global Error Handler)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// تشغيل السيرفر مع Graceful Shutdown للإغلاق الآمن لدعم Prisma
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Center SaaS Backend Server is running on http://${HOST}:${PORT}`);
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