/**
 * WhatsApp Service — Notification sender via Meta Cloud API
 */

const axios = require('axios');

/**
 * Send a WhatsApp message via the Meta Cloud API.
 * @param {string} to — recipient phone number (with country code, no +)
 * @param {string} body — message text
 */
const sendMessage = async (to, body) => {
  try {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;

    if (!apiUrl || !phoneId || !token) {
      console.error('WhatsApp service: Missing environment variables (WHATSAPP_API_URL, WHATSAPP_PHONE_ID, WHATSAPP_TOKEN)');
      return null;
    }

    const url = `${apiUrl}/${phoneId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('WhatsApp send error:', error.response?.data || error.message);
    return null;
  }
};

/**
 * Format currency for display.
 */
const formatRs = (amount) => `Rs ${Number(amount || 0).toFixed(2)}`;

/**
 * Send order alert to admin WhatsApp.
 */
const sendOrderAlertToAdmin = async (order) => {
  try {
    const adminPhone = process.env.ADMIN_WHATSAPP;
    if (!adminPhone) {
      console.error('WhatsApp service: ADMIN_WHATSAPP not configured');
      return null;
    }

    const addr = order.shippingAddress || {};
    const itemLines = (order.items || [])
      .map((item, i) => `  ${i + 1}. ${item.name} (${item.size || '-'}) x${item.quantity} — ${formatRs(item.subtotal)}`)
      .join('\n');

    const message = [
      `🛒 *New Order Received!*`,
      ``,
      `*Order:* ${order.orderNumber}`,
      `*Type:* ${order.userType === 'wholesaler' ? 'Wholesale' : 'Retail'}`,
      `*Customer:* ${addr.fullName || 'N/A'}`,
      `*Phone:* ${addr.phone || 'N/A'}`,
      ``,
      `*Items:*`,
      itemLines,
      ``,
      `*Subtotal:* ${formatRs(order.subtotal)}`,
      `*Shipping:* ${formatRs(order.shippingCharge)}`,
      `*Total:* ${formatRs(order.total)}`,
      `*Payment:* ${order.paymentMode || 'COD'}`,
      ``,
      `*Ship To:*`,
      [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
    ].join('\n');

    return await sendMessage(adminPhone, message);
  } catch (error) {
    console.error('WhatsApp admin alert error:', error.message);
    return null;
  }
};

/**
 * Send order confirmation to customer.
 */
const sendOrderConfirmToCustomer = async (order, phone) => {
  try {
    if (!phone) {
      console.error('WhatsApp service: No customer phone provided');
      return null;
    }

    const itemCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);

    const message = [
      `✅ *Order Confirmed!*`,
      ``,
      `Hi ${order.shippingAddress?.fullName || 'there'},`,
      ``,
      `Your order *${order.orderNumber}* has been placed successfully!`,
      ``,
      `*Items:* ${itemCount} item(s)`,
      `*Total:* ${formatRs(order.total)}`,
      `*Payment:* ${order.paymentMode || 'COD'}`,
      ``,
      `We will notify you once your order is shipped.`,
      ``,
      `Thank you for shopping with Fashion Forward! 🛍️`,
    ].join('\n');

    return await sendMessage(phone, message);
  } catch (error) {
    console.error('WhatsApp customer confirm error:', error.message);
    return null;
  }
};

/**
 * Send shipping/tracking update to customer.
 */
const sendShippingUpdate = async (order, phone) => {
  try {
    if (!phone) {
      console.error('WhatsApp service: No customer phone provided');
      return null;
    }

    const message = [
      `📦 *Order Shipped!*`,
      ``,
      `Hi ${order.shippingAddress?.fullName || 'there'},`,
      ``,
      `Your order *${order.orderNumber}* has been shipped!`,
      ``,
      order.courierPartner ? `*Courier:* ${order.courierPartner}` : null,
      order.trackingNumber ? `*Tracking No:* ${order.trackingNumber}` : null,
      ``,
      `You will receive your order soon. Thank you for shopping with Fashion Forward!`,
    ]
      .filter(Boolean)
      .join('\n');

    return await sendMessage(phone, message);
  } catch (error) {
    console.error('WhatsApp shipping update error:', error.message);
    return null;
  }
};

module.exports = {
  sendOrderAlertToAdmin,
  sendOrderConfirmToCustomer,
  sendShippingUpdate,
};
