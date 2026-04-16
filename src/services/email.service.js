/**
 * Email Service — Notifications using Nodemailer
 */

const nodemailer = require('nodemailer');

/**
 * Create reusable SMTP transporter from environment variables.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

const FROM_NAME = process.env.STORE_NAME || 'Fashion Forward';
const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@fashionforward.in';

/**
 * Responsive HTML email wrapper with Fashion Forward branding.
 */
const wrapHTML = (title, bodyContent) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:1px;">${FROM_NAME}</h1>
              <p style="margin:4px 0 0;color:#e0c097;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Premium Fashion</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:30px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8f8;padding:16px 24px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:12px;color:#999999;">&copy; ${new Date().getFullYear()} ${FROM_NAME}. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:11px;color:#bbbbbb;">This is an automated email. Please do not reply directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/**
 * Send an email. Logs errors but does not throw.
 */
const sendMail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    return info;
  } catch (error) {
    console.error('Email send error:', error.message);
    return null;
  }
};

/**
 * Send order confirmation email with order summary.
 */
const sendOrderConfirmation = async (email, order) => {
  try {
    const addr = order.shippingAddress || {};
    const itemRows = (order.items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;font-size:13px;">${item.name || 'Product'}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;">${item.size || '-'}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;">Rs ${Number(item.subtotal).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const body = `
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;">Order Confirmed!</h2>
      <p style="margin:0 0 20px;color:#555555;font-size:14px;">Thank you for your order. Here are the details:</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;background-color:#f9f9f9;border-radius:6px;padding:12px;">
        <tr>
          <td style="padding:4px 12px;font-size:13px;color:#666;"><strong>Order No:</strong> ${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:13px;color:#666;"><strong>Date:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:13px;color:#666;"><strong>Payment:</strong> ${order.paymentMode || 'COD'}</td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr style="background-color:#1a1a2e;">
          <th style="padding:10px 4px;color:#ffffff;font-size:12px;text-align:left;">Item</th>
          <th style="padding:10px 4px;color:#ffffff;font-size:12px;text-align:center;">Size</th>
          <th style="padding:10px 4px;color:#ffffff;font-size:12px;text-align:center;">Qty</th>
          <th style="padding:10px 4px;color:#ffffff;font-size:12px;text-align:right;">Amount</th>
        </tr>
        ${itemRows}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#666;">Subtotal</td>
          <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">Rs ${Number(order.subtotal || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#666;">Shipping</td>
          <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">Rs ${Number(order.shippingCharge || 0).toFixed(2)}</td>
        </tr>
        ${order.discount ? `
        <tr>
          <td style="padding:4px 0;font-size:13px;color:#666;">Discount</td>
          <td style="padding:4px 0;font-size:13px;color:#666;text-align:right;">-Rs ${Number(order.discount).toFixed(2)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0 4px;font-size:16px;font-weight:bold;color:#1a1a2e;border-top:2px solid #1a1a2e;">Total</td>
          <td style="padding:8px 0 4px;font-size:16px;font-weight:bold;color:#1a1a2e;border-top:2px solid #1a1a2e;text-align:right;">Rs ${Number(order.total || 0).toFixed(2)}</td>
        </tr>
      </table>

      <div style="background-color:#f9f9f9;border-radius:6px;padding:12px;margin-bottom:16px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#333;">Shipping Address:</p>
        <p style="margin:0;font-size:13px;color:#666;">
          ${addr.fullName || ''}<br/>
          ${[addr.line1, addr.line2].filter(Boolean).join(', ')}<br/>
          ${[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}<br/>
          ${addr.phone ? `Phone: ${addr.phone}` : ''}
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:#888;">We will notify you once your order is shipped.</p>
    `;

    return await sendMail(email, `Order Confirmed - ${order.orderNumber}`, wrapHTML('Order Confirmation', body));
  } catch (error) {
    console.error('Email order confirmation error:', error.message);
    return null;
  }
};

/**
 * Send wholesaler account approval email.
 */
const sendWholesalerApproval = async (email, name) => {
  try {
    const body = `
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;">Account Approved!</h2>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">Dear ${name || 'Valued Partner'},</p>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">
        We are pleased to inform you that your wholesaler account with <strong>${FROM_NAME}</strong> has been approved.
      </p>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">
        You can now log in to access wholesale pricing, place bulk orders, and enjoy exclusive wholesale benefits.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.CLIENT_URL || '#'}" style="display:inline-block;background-color:#1a1a2e;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:bold;">Start Shopping</a>
      </div>
      <p style="margin:0;font-size:13px;color:#888;">Welcome aboard! We look forward to a great partnership.</p>
    `;

    return await sendMail(email, 'Wholesaler Account Approved - ' + FROM_NAME, wrapHTML('Account Approved', body));
  } catch (error) {
    console.error('Email wholesaler approval error:', error.message);
    return null;
  }
};

/**
 * Send wholesaler account rejection email with reason.
 */
const sendWholesalerRejection = async (email, name, reason) => {
  try {
    const body = `
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;">Application Update</h2>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">Dear ${name || 'Applicant'},</p>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">
        Thank you for your interest in becoming a wholesale partner with <strong>${FROM_NAME}</strong>.
      </p>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">
        After reviewing your application, we are unable to approve your wholesaler account at this time.
      </p>
      ${reason ? `
      <div style="background-color:#fff3f3;border-left:4px solid #e74c3c;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:13px;color:#333;"><strong>Reason:</strong> ${reason}</p>
      </div>` : ''}
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">
        You are welcome to reapply or contact us for more information. You can continue to shop as a retail customer.
      </p>
      <p style="margin:0;font-size:13px;color:#888;">If you have questions, feel free to reach out to our support team.</p>
    `;

    return await sendMail(email, 'Wholesaler Application Update - ' + FROM_NAME, wrapHTML('Application Update', body));
  } catch (error) {
    console.error('Email wholesaler rejection error:', error.message);
    return null;
  }
};

/**
 * Send password reset email with reset link.
 */
const sendPasswordReset = async (email, resetUrl) => {
  try {
    const body = `
      <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px;">Password Reset</h2>
      <p style="margin:0 0 16px;color:#555555;font-size:14px;">
        We received a request to reset your password. Click the button below to set a new password:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background-color:#1a1a2e;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:bold;">Reset Password</a>
      </div>
      <p style="margin:0 0 8px;color:#555555;font-size:13px;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 16px;word-break:break-all;font-size:12px;color:#1a73e8;">${resetUrl}</p>
      <div style="background-color:#fff8e6;border-left:4px solid #f0ad4e;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:12px;color:#666;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
      <p style="margin:0;font-size:13px;color:#888;">For security, never share this link with anyone.</p>
    `;

    return await sendMail(email, 'Password Reset - ' + FROM_NAME, wrapHTML('Password Reset', body));
  } catch (error) {
    console.error('Email password reset error:', error.message);
    return null;
  }
};

module.exports = {
  sendOrderConfirmation,
  sendWholesalerApproval,
  sendWholesalerRejection,
  sendPasswordReset,
};
