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

  // 2. Seed Default Center
  const center = await prisma.center.create({
    data: {
      id: 'center-101',
      name: 'سنتر النخبة التعليمي',
      email: 'center101@center-saas.com',
      password_hash: 'center123', // In production use bcrypt hash
      phone: '01099998888',
      subscription_status: 'ACTIVE',
      expires_at: new Date('2026-12-31')
    }
  });

  // 3. Seed Default Users
  await prisma.user.createMany({
    data: [
      {
        id: 'u-super-admin',
        username: 'superadmin',
        password: 'admin123',
        role: 'SUPER_ADMIN',
        centerId: null
      },
      {
        id: 'u-center-admin',
        username: 'center101',
        password: 'center123',
        role: 'CENTER_ADMIN',
        centerId: center.id
      }
    ]
  });

  console.log('✅ تم تصفير قاعدة البيانات وإعداد حسابات الدخول والسنتر الرئيسي بنجاح!');
}

main()
  .catch((e) => {
    console.error('❌ خطأ أثناء تصفير قاعدة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });