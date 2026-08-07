const prisma = require('../config/prisma');

exports.executeCheckout = async (req, res) => {
  try {
    const { studentId, bookletId, quantity } = req.body;
    const parsedQuantity = parseInt(quantity) || 1;

    // Execute atomic transaction for POS Checkout
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate booklet and stock
      const booklet = await tx.booklet.findFirst({
        where: { id: bookletId, centerId: req.tenantId }
      });

      if (!booklet || booklet.quantity < parsedQuantity) {
        throw new Error('عفواً، الكمية المتاحة في المخزن غير كافية');
      }

      // 2. Decrement stock
      const updatedBooklet = await tx.booklet.update({
        where: { id: bookletId },
        data: { quantity: { decrement: parsedQuantity } }
      });

      const totalPrice = booklet.price * parsedQuantity;

      // 3. Log InventoryTransaction
      const invTxn = await tx.inventoryTransaction.create({
        data: {
          centerId: req.tenantId,
          type: 'SALE',
          bookletId: bookletId,
          studentId: studentId || null,
          quantityChanged: parsedQuantity,
          totalPrice: totalPrice
        }
      });

      // 4. Record Treasury Income (StudentFeePayment)
      const payment = await tx.studentFeePayment.create({
        data: {
          centerId: req.tenantId,
          studentId: studentId || null,
          bookletId: bookletId,
          amount: totalPrice,
          paymentType: 'BOOKLET_ONLY',
          monthYear: new Date().toISOString().slice(0, 7),
          secretaryName: req.user.username
        }
      });

      // 5. If linked to a teacher, record ServiceSale for commission
      let serviceSale = null;
      if (booklet.teacherId) {
        // Find or create a generic Service for this teacher's booklet sales
        let service = await tx.teacherService.findFirst({
          where: { centerId: req.tenantId, teacherId: booklet.teacherId, type: 'BOOKLET_ONLY' }
        });
        
        if (!service) {
          service = await tx.teacherService.create({
            data: {
              centerId: req.tenantId,
              teacherId: booklet.teacherId,
              type: 'BOOKLET_ONLY',
              title: 'مبيعات مذكرات',
              price: 0
            }
          });
        }

        if (studentId) {
          serviceSale = await tx.serviceSale.create({
            data: {
              centerId: req.tenantId,
              studentId: studentId,
              serviceId: service.id,
              amountPaid: totalPrice
            }
          });
        }
      }

      return { updatedBooklet, invTxn, payment, serviceSale };
    });

    res.status(200).json({ success: true, data: result, message: 'تمت عملية البيع وخصم المخزون بنجاح' });
  } catch (err) {
    console.error("POS Checkout Error:", err);
    res.status(400).json({ success: false, message: err.message || 'فشل إتمام عملية البيع' });
  }
};

exports.getAuditTrail = async (req, res) => {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { centerId: req.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit trail' });
  }
};
