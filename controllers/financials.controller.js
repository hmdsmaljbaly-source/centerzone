const prisma = require('../config/prisma');

exports.executeShiftClosing = async (req, res) => {
  try {
    const { openingCash, actualDrawerCash } = req.body;
    
    // Calculate start of day
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get incoming payments for the day
      const payments = await tx.studentFeePayment.aggregate({
        _sum: { amount: true },
        where: {
          centerId: req.tenantId,
          createdAt: { gte: startOfDay }
        }
      });
      const incomingPayments = payments._sum.amount || 0;

      // 2. Get operational expenses for the day
      const expenses = await tx.expense.aggregate({
        _sum: { amount: true },
        where: {
          centerId: req.tenantId,
          createdAt: { gte: startOfDay }
        }
      });
      const operationalExpenses = expenses._sum.amount || 0;

      // 3. Calculate net expected cash
      const netExpectedCash = parseFloat(openingCash) + incomingPayments - operationalExpenses;
      const discrepancy = parseFloat(actualDrawerCash) - netExpectedCash;

      // 4. Record Shift Closing
      const shiftClosing = await tx.shiftClosing.create({
        data: {
          centerId: req.tenantId,
          openingCash: parseFloat(openingCash),
          incomingPayments: incomingPayments,
          operationalExpenses: operationalExpenses,
          netExpectedCash: netExpectedCash,
          actualDrawerCash: parseFloat(actualDrawerCash),
          discrepancy: discrepancy,
          closedBy: req.user.username,
          date: new Date()
        }
      });

      return shiftClosing;
    });

    res.status(200).json({ success: true, data: result, message: 'Shift closed successfully' });
  } catch (err) {
    console.error("Shift Closing Error:", err);
    res.status(400).json({ success: false, message: 'Failed to execute shift closing' });
  }
};

exports.getFinancialSummary = async (req, res) => {
  try {
    const totalPayments = await prisma.studentFeePayment.aggregate({
      _sum: { amount: true },
      where: { centerId: req.tenantId }
    });

    const totalExpenses = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { centerId: req.tenantId }
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalPayments._sum.amount || 0,
        totalExpenses: totalExpenses._sum.amount || 0,
        netIncome: (totalPayments._sum.amount || 0) - (totalExpenses._sum.amount || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch financial summary' });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { title, category, amount } = req.body;
    if (!title || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: '???? ????? ????? ??????? ?????? ???? ????' });
    }
    const expense = await prisma.expense.create({
      data: {
        centerId: req.tenantId,
        title: title.trim(),
        category: category || '????',
        amount: parseFloat(amount)
      }
    });
    res.status(201).json({ success: true, message: '?? ????? ??????? ???????? ?????', data: expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { centerId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: expenses });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.createPayout = async (req, res) => {
  try {
    const { teacherId, amount, notes } = req.body;
    if (!teacherId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: '?????? ??????? ??? ?????? ?? ?????? ??? ????' });
    }
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, centerId: req.tenantId }
    });
    if (!teacher) {
      return res.status(404).json({ success: false, message: '?????? ??? ????? ?? ?? ???? ???? ??????' });
    }
    const payout = await prisma.teacherPayout.create({
      data: {
        centerId: req.tenantId,
        teacherId,
        amount: parseFloat(amount),
        notes: notes || '????? ??????? ?????'
      }
    });
    res.status(201).json({ success: true, message: '?? ????? ?????? ?????? ?????', data: payout });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

