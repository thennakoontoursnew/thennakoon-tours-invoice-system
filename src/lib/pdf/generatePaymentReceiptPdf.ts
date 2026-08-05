import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoicePayment } from '@/lib/types';
import { formatDate, formatLKR } from '@/lib/utils';

export function createPaymentReceiptPdf(
  invoice: Invoice,
  payment: InvoicePayment
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2; // 178mm

  const receiptNum = `TT-REC-${payment.id ? payment.id.slice(0, 8).toUpperCase() : '10001'}`;

  // 1. Dark Top Banner Header
  doc.setFillColor(24, 24, 27); // #18181b
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(234, 179, 8); // Amber Gold #eab308
  doc.text('THENNAKOON TOURS (PVT) LTD', marginX, 16);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL PAYMENT RECEIPT', marginX, 24);

  // Top Right Receipt Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(234, 179, 8);
  doc.text(`RECEIPT NO: ${receiptNum}`, pageWidth - marginX, 16, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`Payment Date: ${formatDate(payment.payment_date)}`, pageWidth - marginX, 23, { align: 'right' });
  doc.text(`Invoice Ref: ${invoice.invoice_number}`, pageWidth - marginX, 29, { align: 'right' });

  let currentY = 44;

  // Reversal Banner if Reversed
  if (payment.is_reversed) {
    doc.setFillColor(254, 242, 242); // Light red
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(marginX, currentY, contentWidth, 12, 1.5, 1.5, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text('PAYMENT REVERSED / CANCELLED', marginX + 4, currentY + 7);
    if (payment.reversal_reason) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Reason: ${payment.reversal_reason}`, pageWidth - marginX - 4, currentY + 7, { align: 'right' });
    }
    currentY += 16;
  }

  // 2. Customer & Company Details Grid (Two Boxes)
  const colW = (contentWidth - 6) / 2;

  // Box 1: Received From (Customer)
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(225, 225, 230);
  doc.roundedRect(marginX, currentY, colW, 36, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 120);
  doc.text('RECEIVED FROM:', marginX + 4, currentY + 6);

  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.customer_name || 'Valued Customer', marginX + 4, currentY + 13);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  if (invoice.customer_phone) {
    doc.text(`Phone: ${invoice.customer_phone}`, marginX + 4, currentY + 19);
  }
  if (invoice.customer_email) {
    doc.text(`Email: ${invoice.customer_email}`, marginX + 4, currentY + 24);
  }
  if (invoice.customer_address) {
    doc.text(`Address: ${invoice.customer_address.slice(0, 35)}`, marginX + 4, currentY + 29);
  }

  // Box 2: Payment Metadata
  const box2X = marginX + colW + 6;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(225, 225, 230);
  doc.roundedRect(box2X, currentY, colW, 36, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 120);
  doc.text('PAYMENT DETAILS:', box2X + 4, currentY + 6);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(`Payment Method: ${payment.payment_method}`, box2X + 4, currentY + 13);
  doc.text(`Reference No: ${payment.reference_number || 'N/A'}`, box2X + 4, currentY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice Date: ${formatDate(invoice.invoice_date)}`, box2X + 4, currentY + 25);
  doc.text(`Received By: ${payment.created_by_name || 'System Staff'}`, box2X + 4, currentY + 30);

  currentY += 42;

  // 3. Payment Breakdown Table
  const tableRows = [
    [
      `Payment towards Invoice ${invoice.invoice_number}`,
      payment.payment_method,
      payment.reference_number || '-',
      formatLKR(payment.amount),
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Description / Purpose', 'Method', 'Reference No', 'Amount Received']],
    body: tableRows,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [234, 179, 8],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 30, 30],
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 33 },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  // Fetch final Y after table
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || currentY + 20;
  currentY = finalY + 8;

  // 4. Financial Summary Summary Box
  const summaryBoxW = 90;
  const summaryBoxX = pageWidth - marginX - summaryBoxW;

  doc.setFillColor(245, 245, 248);
  doc.setDrawColor(220, 220, 225);
  doc.roundedRect(summaryBoxX, currentY, summaryBoxW, 30, 2, 2, 'FD');

  let lineY = currentY + 7;
  const drawSummaryLine = (label: string, value: string, isBold = false, color = [30, 30, 30]) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(label, summaryBoxX + 5, lineY);

    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, summaryBoxX + summaryBoxW - 5, lineY, { align: 'right' });
    lineY += 7;
  };

  drawSummaryLine('Invoice Net Amount:', formatLKR(invoice.net_amount));
  drawSummaryLine('Amount Received:', formatLKR(payment.amount), true, [16, 185, 129]); // Emerald
  drawSummaryLine('Remaining Balance Due:', formatLKR(payment.running_balance ?? invoice.balance_due), true, [239, 68, 68]); // Red

  // Notes section if present
  if (payment.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Payment Notes:', marginX, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const splitNotes = doc.splitTextToSize(payment.notes, 75);
    doc.text(splitNotes, marginX, currentY + 12);
  }

  currentY += 40;

  // 5. Signatures & Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('AUTHORISED SIGNATURE', pageWidth - marginX - 45, currentY);
  doc.line(pageWidth - marginX - 55, currentY - 2, pageWidth - marginX, currentY - 2);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('Thank you for choosing Thennakoon Tours (Pvt) Ltd.', marginX, currentY);
  doc.text('This is a computer-generated receipt.', marginX, currentY + 4);

  return doc;
}

export function downloadPaymentReceiptPdf(invoice: Invoice, payment: InvoicePayment): void {
  const doc = createPaymentReceiptPdf(invoice, payment);
  const receiptNum = `TT-REC-${payment.id ? payment.id.slice(0, 8).toUpperCase() : '10001'}`;
  doc.save(`${receiptNum}-${invoice.invoice_number}.pdf`);
}

export function getPaymentReceiptPdfBlobUrl(invoice: Invoice, payment: InvoicePayment): string {
  const doc = createPaymentReceiptPdf(invoice, payment);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
