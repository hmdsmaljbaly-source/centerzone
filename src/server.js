const app = require('./app');
const prisma = require('./config/prisma');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // مهم جداً ليعمل السيرفر بشكل صحيح على منصات مثل Railway

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
// Trigger Railway deploy
