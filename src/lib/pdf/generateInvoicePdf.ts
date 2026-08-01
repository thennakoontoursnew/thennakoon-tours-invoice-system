import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '../types';
import { formatDate, formatLKR } from '../utils';

// Helper to convert an image URL or static path to Data URL / Base64 for jsPDF
async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function createInvoicePdfDoc(invoice: Invoice): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2; // 180mm

  // 1. Render Background Letterhead if enabled
  const letterheadUrl =
    invoice.company_snapshot?.letterhead_url ||
    '/documents/thennakoon-tours-letterhead.png';
  const isLetterheadEnabled = invoice.company_snapshot?.letterhead_enabled !== false;

  if (isLetterheadEnabled && letterheadUrl) {
    try {
      const letterheadBase64 = await getBase64ImageFromUrl(letterheadUrl);
      if (letterheadBase64) {
        doc.addImage(letterheadBase64, 'PNG', 0, 0, pageWidth, pageHeight);
      }
    } catch (e) {
      console.warn('Could not load letterhead background image:', e);
    }
  }

  // Safe vertical offsets
  // Top margin is 44mm to clear letterhead header artwork
  let currentY = 44;

  // Header Title & Primary Invoice Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(217, 119, 6); // Amber gold #d97706
  doc.text('INVOICE', marginX, currentY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(`# ${invoice.invoice_number}`, marginX + 45, currentY);

  // Status Badge on Right Top
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const statusStr = (invoice.status || 'DRAFT').toUpperCase();
  doc.setTextColor(30, 30, 30);
  doc.text(`STATUS: ${statusStr}`, pageWidth - marginX, currentY, { align: 'right' });

  currentY += 8;

  // Divider Line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 6;

  // SECTION 1: INVOICE DETAILS & CUSTOMER / RENTAL (2 Columns)
  const col1X = marginX;
  const col2X = marginX + 92;
  const colWidth = 86;

  // Customer Details (Left Box)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 130, 20);
  doc.text('INVOICE TO:', col1X, currentY);

  let custY = currentY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.customer_name || 'Valued Customer', col1X, custY);
  custY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 70);

  if (invoice.customer_company) {
    doc.text(`Company: ${invoice.customer_company}`, col1X, custY);
    custY += 4;
  }
  if (invoice.customer_phone) {
    doc.text(`Phone: ${invoice.customer_phone}`, col1X, custY);
    custY += 4;
  }
  if (invoice.customer_email) {
    doc.text(`Email: ${invoice.customer_email}`, col1X, custY);
    custY += 4;
  }
  if (invoice.customer_address) {
    const splitAddr = doc.splitTextToSize(`Address: ${invoice.customer_address}`, colWidth);
    doc.text(splitAddr, col1X, custY);
    custY += splitAddr.length * 3.8;
  }
  if (invoice.customer_reference) {
    doc.text(`Ref: ${invoice.customer_reference}`, col1X, custY);
    custY += 4;
  }

  // Invoice Meta & Vehicle Details (Right Box)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 130, 20);
  doc.text('INVOICE METADATA & RENTAL:', col2X, currentY);

  let metaY = currentY + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);

  doc.text(`Invoice Date: ${formatDate(invoice.invoice_date)}`, col2X, metaY);
  metaY += 4;
  doc.text(`Due Date: ${formatDate(invoice.due_date)}`, col2X, metaY);
  metaY += 4;
  doc.text(`Payment Terms: ${invoice.payment_terms || '7 Days'}`, col2X, metaY);
  metaY += 4;

  if (invoice.quotation_reference) {
    doc.text(`Quotation Ref: ${invoice.quotation_reference}`, col2X, metaY);
    metaY += 4;
  }

  if (invoice.vehicle_name || invoice.vehicle_registration_number) {
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Vehicle: ${invoice.vehicle_name || ''} ${
        invoice.vehicle_registration_number ? `(${invoice.vehicle_registration_number})` : ''
      }`,
      col2X,
      metaY
    );
    doc.setFont('helvetica', 'normal');
    metaY += 4;
  }

  if (invoice.rental_start_date || invoice.rental_end_date) {
    doc.text(
      `Period: ${formatDate(invoice.rental_start_date)} to ${formatDate(invoice.rental_end_date)} (${
        invoice.rental_days || 1
      } Days)`,
      col2X,
      metaY
    );
    metaY += 4;
  }

  if (invoice.destination) {
    doc.text(`Destination: ${invoice.destination}`, col2X, metaY);
    metaY += 4;
  }

  // Set currentY to max of columns
  currentY = Math.max(custY, metaY) + 4;

  // SECTION 2: ITEMS TABLE
  const tableItems = (invoice.items_snapshot && invoice.items_snapshot.length > 0)
    ? invoice.items_snapshot
    : [
        {
          description: 'Vehicle Rental Service',
          quantity: 1,
          unit_price: invoice.subtotal || 0,
          line_total: invoice.subtotal || 0,
        },
      ];

  const tableBody = tableItems.map((item, idx) => [
    (idx + 1).toString(),
    item.description || '-',
    item.quantity?.toString() || '1',
    formatLKR(item.unit_price || 0),
    formatLKR(item.line_total || 0),
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['#', 'Description', 'Qty', 'Unit Price', 'Line Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [24, 24, 27], // Dark Zinc #18181b
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [40, 40, 40],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  // Get final Y after table
  const docWithAutoTable = doc as unknown as { lastAutoTable: { finalY: number } };
  currentY = docWithAutoTable.lastAutoTable.finalY + 6;

  // SECTION 3: FINANCIAL SUMMARY & BANK DETAILS
  const sumLeftX = marginX;
  const sumRightX = marginX + 100;
  const sumRightWidth = 80;

  // Left Side: Bank Details & QR
  const bank = invoice.bank_snapshot || {};
  let leftY = currentY;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 130, 20);
  doc.text('PAYMENT & BANK DETAILS:', sumLeftX, leftY);
  leftY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  if (bank.account_name) {
    doc.text(`Account Name: ${bank.account_name}`, sumLeftX, leftY);
    leftY += 3.8;
  }
  if (bank.bank_name) {
    doc.text(`Bank: ${bank.bank_name} ${bank.branch ? `(${bank.branch})` : ''}`, sumLeftX, leftY);
    leftY += 3.8;
  }
  if (bank.account_number) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Account No: ${bank.account_number}`, sumLeftX, leftY);
    doc.setFont('helvetica', 'normal');
    leftY += 3.8;
  }
  if (bank.swift_code) {
    doc.text(`Swift Code: ${bank.swift_code}`, sumLeftX, leftY);
    leftY += 3.8;
  }

  // QR Code Image if available
  const qr = invoice.qr_snapshot;
  if (qr?.qr_enabled && qr?.qr_image_url) {
    try {
      const qrBase64 = await getBase64ImageFromUrl(qr.qr_image_url);
      if (qrBase64) {
        doc.addImage(qrBase64, 'PNG', sumLeftX, leftY + 2, 22, 22);
        if (qr.qr_label) {
          doc.setFontSize(7);
          doc.text(qr.qr_label, sumLeftX + 25, leftY + 12);
        }
        leftY += 26;
      }
    } catch {
      // Ignore QR image fail
    }
  }

  // Right Side: Totals Breakdown Table
  let rightY = currentY;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const addTotalRow = (label: string, value: number, isBold = false, isHighlight = false, prefix = '') => {
    if (isHighlight) {
      doc.setFillColor(24, 24, 27);
      doc.rect(sumRightX, rightY - 3, sumRightWidth, 6.5, 'F');
      doc.setTextColor(250, 204, 21); // Yellow accent
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
    } else if (isBold) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(8.5);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8.5);
    }

    doc.text(label, sumRightX + 2, rightY);
    doc.text(`${prefix}${formatLKR(value)}`, sumRightX + sumRightWidth - 2, rightY, { align: 'right' });
    rightY += isHighlight ? 7.5 : 4.5;
  };

  addTotalRow('Subtotal', invoice.subtotal || 0);

  if (invoice.tax_amount && invoice.tax_amount > 0) {
    addTotalRow('Tax', invoice.tax_amount);
  }
  if (invoice.discount && invoice.discount > 0) {
    addTotalRow('Discount', invoice.discount, false, false, '- ');
  }
  if (invoice.deduction && invoice.deduction > 0) {
    addTotalRow('Deduction', invoice.deduction, false, false, '- ');
  }
  if (invoice.advance_payment && invoice.advance_payment > 0) {
    addTotalRow('Advance Payment', invoice.advance_payment, false, false, '- ');
  }

  addTotalRow('Net Amount', invoice.net_amount || 0, true);

  if (invoice.amount_paid && invoice.amount_paid > 0) {
    addTotalRow('Amount Paid', invoice.amount_paid, false, false, '- ');
  }

  addTotalRow('BALANCE DUE', invoice.balance_due || 0, true, true);

  currentY = Math.max(leftY, rightY) + 6;

  // SECTION 4: NOTES & PREPARED BY
  if (invoice.special_notes || invoice.important_notes) {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 5;

    if (invoice.special_notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 130, 20);
      doc.text('SPECIAL NOTES:', marginX, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      const splitSpecial = doc.splitTextToSize(invoice.special_notes, contentWidth);
      doc.text(splitSpecial, marginX, currentY);
      currentY += splitSpecial.length * 3.6 + 2;
    }

    if (invoice.important_notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 130, 20);
      doc.text('IMPORTANT TERMS & CONDITIONS:', marginX, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      const splitImp = doc.splitTextToSize(invoice.important_notes, contentWidth);
      doc.text(splitImp, marginX, currentY, { align: 'justify' });
      currentY += splitImp.length * 3.6 + 4;
    }
  }

  // Prepared By Signature Block (Bottom Safe Area ~240mm)
  const prepY = Math.max(currentY, 240);
  const prepX = pageWidth - marginX - 55;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('PREPARED BY:', prepX, prepY);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(prepX, prepY + 10, prepX + 55, prepY + 10);

  const prepName = invoice.prepared_by_snapshot?.full_name || invoice.prepared_by || 'Authorized Officer';
  const prepDesig = invoice.prepared_by_snapshot?.designation || 'Executive';

  doc.setFont('helvetica', 'bold');
  doc.text(prepName, prepX, prepY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(prepDesig, prepX, prepY + 18);
  doc.text('Thennakoon Tours (Pvt) Ltd', prepX, prepY + 22);

  return doc;
}

export function formatInvoicePdfFilename(invoice: Invoice): string {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '-');
  const cust = sanitize(invoice.customer_name || 'Customer');
  const num = sanitize(invoice.invoice_number || 'TT-IN-1001');
  return `TT-Invoice-${num}-${cust}.pdf`;
}

export async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const doc = await createInvoicePdfDoc(invoice);
  const filename = formatInvoicePdfFilename(invoice);
  doc.save(filename);
}

export async function getInvoicePdfDataUrl(invoice: Invoice): Promise<string> {
  const doc = await createInvoicePdfDoc(invoice);
  return doc.output('datauristring');
}
