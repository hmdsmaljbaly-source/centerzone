const { PrismaClient } = require('@prisma/client');

// تطبيق نمط Singleton للحد من كثرة الاتصالات بقاعدة البيانات أثناء التطوير
const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

module.exports = prisma;
