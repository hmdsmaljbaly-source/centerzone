const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 جاري تصفير وإعادة ضبط قاعدة بيانات Center System SaaS...');

  // 1. Clean operational tables in correct dependency order
  await prisma.attendance.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.evaluation.deleteMany({});
  await prisma.serviceSale.deleteMany({});
  await prisma.teacherService.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.teacher.deleteMany({});
  await prisma.systemLogMessage.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.center.deleteMany({});

  console.log('🧹 تم تصفير كافة بيانات الجداول الفرعية والتأكد من نظافتها.');

  // 2. Seed Default Super Admin Account
  const bcrypt = require('bcrypt');
  const hashedPassword = await bcrypt.hash('gebo777', 10);
  
  await prisma.user.create({
    data: {
      id: 'u-super-admin',
      username: 'super_admain',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      centerId: null
    }
  });

  console.log('✅ تم تصفير قاعدة البيانات وإعداد حساب السوبر أدمن super_admain بنجاح!');
}

main()
  .catch((e) => {
    console.error('❌ خطأ أثناء تصفير قاعدة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });