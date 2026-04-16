/**
 * PDF Service — Bill/Invoice PDF generation using PDFKit
 */

const PDFDocument = require('pdfkit');

/**
 * Generate a professional invoice PDF for an order.
 * Returns a Promise that resolves to a Buffer.
 */
const generateBillPDF = (order, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const storeName = process.env.STORE_NAME || 'Fashion Forward';
      const storeAddress = process.env.STORE_ADDRESS || '';
      const storePhone = process.env.STORE_PHONE || '';
      const storeGSTIN = process.env.STORE_GSTIN || '';

      const pageWidth = doc.page.width - 100; // accounting for margins

      // --- Header ---
      doc.fontSize(22).font('Helvetica-Bold').text(storeName, { align: 'center' });
      doc.moveDown(0.3);

      if (storeAddress) {
        doc.fontSize(9).font('Helvetica').text(storeAddress, { align: 'center' });
      }
      if (storePhone) {
        doc.fontSize(9).text(`Phone: ${storePhone}`, { align: 'center' });
      }
      if (storeGSTIN) {
        doc.fontSize(9).text(`GSTIN: ${storeGSTIN}`, { align: 'center' });
      }

      doc.moveDown(0.5);

      // Divider
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#333333');
      doc.moveDown(0.5);

      // --- Invoice info ---
      doc.fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
      doc.moveDown(0.5);

      const invoiceDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : new Date().toLocaleDateString('en-IN');

      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice No: ${order.orderNumber}`, 50);
      doc.text(`Date: ${invoiceDate}`, 50);
      doc.text(`Payment Mode: ${order.paymentMode || 'COD'}`, 50);
      doc.moveDown(1);

      // --- Billing & Shipping Address ---
      const addr = order.shippingAddress || {};
      const addressY = doc.y;

      // Billing info (left side)
      doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', 50, addressY);
      doc.font('Helvetica').fontSize(9);
      doc.text(addr.fullName || user?.name || 'Customer', 50);
      doc.text(user?.email || '', 50);
      doc.text(user?.phone || addr.phone || '', 50);

      // Shipping address (right side)
      const rightCol = 320;
      doc.fontSize(10).font('Helvetica-Bold').text('Ship To:', rightCol, addressY);
      doc.font('Helvetica').fontSize(9);
      doc.text(addr.fullName || '', rightCol);
      if (addr.line1) doc.text(addr.line1, rightCol);
      if (addr.line2) doc.text(addr.line2, rightCol);
      doc.text(
        [addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
        rightCol
      );
      if (addr.phone) doc.text(`Phone: ${addr.phone}`, rightCol);

      doc.moveDown(2);

      // --- Items Table ---
      const tableTop = doc.y;
      const colWidths = {
        num: 30,
        item: 170,
        size: 50,
        qty: 45,
        rate: 75,
        amount: 80,
      };

      // Table header background
      doc.rect(50, tableTop, pageWidth, 20).fill('#333333');
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');

      let x = 50;
      doc.text('#', x + 5, tableTop + 5, { width: colWidths.num, align: 'center' });
      x += colWidths.num;
      doc.text('Item', x + 5, tableTop + 5, { width: colWidths.item });
      x += colWidths.item;
      doc.text('Size', x + 5, tableTop + 5, { width: colWidths.size, align: 'center' });
      x += colWidths.size;
      doc.text('Qty', x + 5, tableTop + 5, { width: colWidths.qty, align: 'center' });
      x += colWidths.qty;
      doc.text('Rate', x + 5, tableTop + 5, { width: colWidths.rate, align: 'right' });
      x += colWidths.rate;
      doc.text('Amount', x + 5, tableTop + 5, { width: colWidths.amount, align: 'right' });

      doc.fillColor('#000000');

      // Table rows
      let rowY = tableTop + 25;
      const items = order.items || [];

      items.forEach((item, index) => {
        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(50, rowY - 3, pageWidth, 20).fill('#f9f9f9');
          doc.fillColor('#000000');
        }

        x = 50;
        doc.font('Helvetica').fontSize(8);
        doc.text(String(index + 1), x + 5, rowY, { width: colWidths.num, align: 'center' });
        x += colWidths.num;
        doc.text(item.name || 'Product', x + 5, rowY, { width: colWidths.item - 10 });
        x += colWidths.item;
        doc.text(item.size || '-', x + 5, rowY, { width: colWidths.size, align: 'center' });
        x += colWidths.size;
        doc.text(String(item.quantity), x + 5, rowY, { width: colWidths.qty, align: 'center' });
        x += colWidths.qty;
        doc.text(`Rs ${item.pricePerPiece.toFixed(2)}`, x + 5, rowY, {
          width: colWidths.rate,
          align: 'right',
        });
        x += colWidths.rate;
        doc.text(`Rs ${item.subtotal.toFixed(2)}`, x + 5, rowY, {
          width: colWidths.amount,
          align: 'right',
        });

        rowY += 20;
      });

      // Table bottom line
      doc.moveTo(50, rowY + 2).lineTo(50 + pageWidth, rowY + 2).stroke('#333333');
      rowY += 10;

      // --- Totals ---
      const totalsX = 370;
      doc.font('Helvetica').fontSize(10);

      doc.text('Subtotal:', totalsX, rowY);
      doc.text(`Rs ${(order.subtotal || 0).toFixed(2)}`, totalsX + 100, rowY, {
        width: 80,
        align: 'right',
      });
      rowY += 18;

      doc.text('Shipping:', totalsX, rowY);
      doc.text(`Rs ${(order.shippingCharge || 0).toFixed(2)}`, totalsX + 100, rowY, {
        width: 80,
        align: 'right',
      });
      rowY += 18;

      if (order.discount && order.discount > 0) {
        doc.text('Discount:', totalsX, rowY);
        doc.text(`-Rs ${order.discount.toFixed(2)}`, totalsX + 100, rowY, {
          width: 80,
          align: 'right',
        });
        rowY += 18;
      }

      // Total line
      doc.moveTo(totalsX, rowY).lineTo(totalsX + 180, rowY).stroke('#333333');
      rowY += 8;

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total:', totalsX, rowY);
      doc.text(`Rs ${(order.total || 0).toFixed(2)}`, totalsX + 100, rowY, {
        width: 80,
        align: 'right',
      });

      // --- Footer / COD Terms ---
      rowY += 40;
      doc.moveTo(50, rowY).lineTo(50 + pageWidth, rowY).stroke('#cccccc');
      rowY += 10;

      doc.font('Helvetica-Bold').fontSize(9).text('Terms & Conditions:', 50, rowY);
      rowY += 14;
      doc.font('Helvetica').fontSize(8);
      doc.text('1. This is a Cash on Delivery (COD) order. Payment is to be collected at the time of delivery.', 50, rowY, { width: pageWidth });
      rowY += 12;
      doc.text('2. Goods once sold will not be taken back or exchanged unless defective.', 50, rowY, { width: pageWidth });
      rowY += 12;
      doc.text('3. Any disputes are subject to local jurisdiction.', 50, rowY, { width: pageWidth });
      rowY += 20;

      doc.fontSize(8).fillColor('#888888').text('Thank you for shopping with ' + storeName + '!', 50, rowY, {
        align: 'center',
        width: pageWidth,
      });

      doc.end();
    } catch (error) {
      console.error('Error generating bill PDF:', error.message);
      reject(error);
    }
  });
};

module.exports = {
  generateBillPDF,
};
