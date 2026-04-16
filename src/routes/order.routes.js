const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  createOrder, getMyOrders, getOrderById, cancelOrder, downloadBill,
} = require('../controllers/order.controller');

// All routes require auth
router.use(protect);

router.post('/', createOrder);
router.get('/my-orders', getMyOrders);
router.get('/:id', getOrderById);
router.put('/:id/cancel', cancelOrder);
router.get('/:id/bill', downloadBill);

module.exports = router;
