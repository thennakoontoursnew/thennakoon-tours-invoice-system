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

// Reusable label-value renderer with aligned colons
function drawLabelValueRow(
  doc: jsPDF,
  label: string,
  value: string | undefined | null,
  labelX: number,
  colonX: number,
  valueX: number,
  y: number,
  maxValueWidth: number = 60,
  isBoldValue: boolean = false
): number {
  if (!value) return 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 70);
  doc.text(label, labelX, y);
  doc.text(':', colonX, y);

  if (isBoldValue) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
  }

  const splitVal = doc.splitTextToSize(value, maxValueWidth);
  doc.text(splitVal, valueX, y);
  return splitVal.length * 4.2;
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

  // Helper to render letterhead background image
  const renderBackground = async () => {
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
  };

  await renderBackground();

  // Top margin is 46mm to clear top-left letterhead artwork completely
  let currentY = 46;
  const headerX = 18; // Safe X offset from left edge

  // 1. HEADER AREA
  // Left: INVOICE Heading + Invoice Date directly below
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0); // Solid Black
  doc.text('INVOICE', headerX, currentY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`Invoice Date: ${formatDate(invoice.invoice_date)}`, headerX, currentY + 6);

  // Right: INVOICE NO: + TT-IN-1001 (No Status)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('INVOICE NO:', pageWidth - marginX, currentY, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.invoice_number || 'TT-IN-1001', pageWidth - marginX, currentY + 6, { align: 'right' });

  currentY += 15;

  // Divider Line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 6;

  // 2. INVOICE TO & RENTAL METADATA (2 Columns with aligned colons)
  const col1X = marginX;
  const colon1X = marginX + 20;
  const val1X = marginX + 23;
  const val1Width = 58;

  const col2X = marginX + 92;
  const colon2X = marginX + 92 + 25;
  const val2X = marginX + 92 + 28;
  const val2Width = 60;

  // Left Column: Customer Details
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 130, 20);
  doc.text('INVOICE TO:', col1X, currentY);

  let custY = currentY + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.customer_name || 'Valued Customer', col1X, custY);
  custY += 5;

  if (invoice.customer_company) {
    custY += drawLabelValueRow(doc, 'Company', invoice.customer_company, col1X, colon1X, val1X, custY, val1Width);
  }
  if (invoice.customer_phone) {
    custY += drawLabelValueRow(doc, 'Phone', invoice.customer_phone, col1X, colon1X, val1X, custY, val1Width);
  }
  if (invoice.customer_email) {
    custY += drawLabelValueRow(doc, 'Email', invoice.customer_email, col1X, colon1X, val1X, custY, val1Width);
  }
  if (invoice.customer_address) {
    custY += drawLabelValueRow(doc, 'Address', invoice.customer_address, col1X, colon1X, val1X, custY, val1Width);
  }
  if (invoice.customer_reference) {
    custY += drawLabelValueRow(doc, 'Reference', invoice.customer_reference, col1X, colon1X, val1X, custY, val1Width);
  }

  // Right Column: Rental Metadata (No Invoice Date, No Payment Terms)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 130, 20);
  doc.text('INVOICE METADATA & RENTAL:', col2X, currentY);

  let metaY = currentY + 5.5;

  if (invoice.due_date) {
    metaY += drawLabelValueRow(doc, 'Due Date', formatDate(invoice.due_date), col2X, colon2X, val2X, metaY, val2Width, true);
  }

  const vehicleStr = `${invoice.vehicle_name || ''} ${
    invoice.vehicle_registration_number ? `(${invoice.vehicle_registration_number})` : ''
  }`.trim();

  if (vehicleStr) {
    metaY += drawLabelValueRow(doc, 'Vehicle', vehicleStr, col2X, colon2X, val2X, metaY, val2Width, true);
  }

  if (invoice.rental_start_date || invoice.rental_end_date) {
    const periodStr = `${formatDate(invoice.rental_start_date)} to ${formatDate(invoice.rental_end_date)} (${
      invoice.rental_days || 1
    } Days)`;
    metaY += drawLabelValueRow(doc, 'Rental Period', periodStr, col2X, colon2X, val2X, metaY, val2Width);
  }

  if (invoice.destination) {
    metaY += drawLabelValueRow(doc, 'Destination', invoice.destination, col2X, colon2X, val2X, metaY, val2Width);
  }

  if (invoice.quotation_reference) {
    metaY += drawLabelValueRow(doc, 'Quotation Ref', invoice.quotation_reference, col2X, colon2X, val2X, metaY, val2Width);
  }

  currentY = Math.max(custY, metaY) + 5;

  // 3. INVOICE ITEMS TABLE
  const tableItems =
    invoice.items_snapshot && invoice.items_snapshot.length > 0
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

  const docWithAutoTable = doc as unknown as { lastAutoTable: { finalY: number } };
  currentY = docWithAutoTable.lastAutoTable.finalY + 6;

  // 4. PAYMENT SUMMARY (Right aligned, below table)
  const sumRightX = marginX + 95;
  const sumRightWidth = 85;
  let summaryY = currentY;

  const addTotalRow = (
    label: string,
    value: number,
    isBold = false,
    isHighlight = false,
    prefix = ''
  ) => {
    if (isHighlight) {
      doc.setFillColor(24, 24, 27);
      doc.rect(sumRightX, summaryY - 3, sumRightWidth, 7, 'F');
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

    doc.text(label, sumRightX + 2.5, summaryY);
    doc.text(`${prefix}${formatLKR(value)}`, sumRightX + sumRightWidth - 2.5, summaryY, {
      align: 'right',
    });
    summaryY += isHighlight ? 8 : 4.8;
  };

  addTotalRow('Subtotal', invoice.subtotal || 0);

  if (invoice.discount && invoice.discount > 0) {
    addTotalRow('Discount', invoice.discount, false, false, '- ');
  }

  // Deductions handling (support optional multi-item deductions)
  const deductionItems =
    invoice.deduction_items && invoice.deduction_items.length > 0
      ? invoice.deduction_items
      : invoice.deduction && invoice.deduction > 0
      ? [{ description: 'Deduction', amount: invoice.deduction }]
      : [];

  const totalDeductionsAmt = deductionItems.reduce(
    (acc, item) => acc + (item.amount || 0),
    0
  );

  deductionItems.forEach((d) => {
    if (d.amount > 0) {
      addTotalRow(d.description || 'Deduction', d.amount, false, false, '- ');
    }
  });

  if (deductionItems.length > 1 && totalDeductionsAmt > 0) {
    addTotalRow('Total Deductions', totalDeductionsAmt, true, false, '- ');
  }

  if (invoice.advance_payment && invoice.advance_payment > 0) {
    addTotalRow('Advance Payment', invoice.advance_payment, false, false, '- ');
  }

  if (invoice.tax_amount && invoice.tax_amount > 0) {
    addTotalRow('Tax', invoice.tax_amount, false, false, '+ ');
  }

  addTotalRow('Net Amount', invoice.net_amount || 0, true);

  if (invoice.amount_paid && invoice.amount_paid > 0) {
    addTotalRow('Amount Paid', invoice.amount_paid, false, false, '- ');
  }

  addTotalRow('BALANCE DUE', invoice.balance_due || 0, true, true);

  currentY = summaryY + 6;

  // 5. PAYMENT & BANK DETAILS (Placed BELOW Balance Due)
  const bank = invoice.bank_snapshot || {};
  const bankColX = marginX;
  const bankColonX = marginX + 30;
  const bankValX = marginX + 33;
  const bankValWidth = 100;

  if (bank.account_name || bank.account_number || bank.bank_name) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 130, 20);
    doc.text('PAYMENT & BANK DETAILS:', bankColX, currentY);
    currentY += 5.5;

    if (bank.account_name) {
      currentY += drawLabelValueRow(doc, 'Account Name', bank.account_name, bankColX, bankColonX, bankValX, currentY, bankValWidth);
    }
    const bankDetailsStr = `${bank.bank_name || ''} ${bank.branch ? `(${bank.branch})` : ''}`.trim();
    if (bankDetailsStr) {
      currentY += drawLabelValueRow(doc, 'Bank', bankDetailsStr, bankColX, bankColonX, bankValX, currentY, bankValWidth);
    }
    if (bank.account_number) {
      currentY += drawLabelValueRow(doc, 'Account No', bank.account_number, bankColX, bankColonX, bankValX, currentY, bankValWidth, true);
    }
    if (bank.swift_code) {
      currentY += drawLabelValueRow(doc, 'Swift Code', bank.swift_code, bankColX, bankColonX, bankValX, currentY, bankValWidth);
    }

    currentY += 4;
  }

  // QR Code Image if enabled
  const qr = invoice.qr_snapshot;
  if (qr?.qr_enabled && qr?.qr_image_url) {
    try {
      const qrBase64 = await getBase64ImageFromUrl(qr.qr_image_url);
      if (qrBase64) {
        doc.addImage(qrBase64, 'PNG', bankColX, currentY, 20, 20);
        if (qr.qr_label) {
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          doc.text(qr.qr_label, bankColX + 23, currentY + 10);
        }
        currentY += 23;
      }
    } catch {
      // Ignore QR fail
    }
  }

  // 6. SPECIAL NOTES & IMPORTANT TERMS (If present)
  if (invoice.special_notes || invoice.important_notes) {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 5;

    if (invoice.special_notes) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 130, 20);
      doc.text('SPECIAL NOTES:', marginX, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      const splitSpecial = doc.splitTextToSize(invoice.special_notes, contentWidth);
      doc.text(splitSpecial, marginX, currentY);
      currentY += splitSpecial.length * 3.6 + 3;
    }

    if (invoice.important_notes) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 130, 20);
      doc.text('IMPORTANT TERMS & CONDITIONS:', marginX, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      const splitImp = doc.splitTextToSize(invoice.important_notes, contentWidth);
      doc.text(splitImp, marginX, currentY);
      currentY += splitImp.length * 3.8 + 4;
    }
  }

  // 7. PREPARED BY SECTION (Left-aligned, No Signature Line)
  // Check if we need page overflow protection
  if (currentY > 255) {
    doc.addPage();
    await renderBackground();
    currentY = 44;
  } else {
    currentY += 6;
  }

  const prepName = invoice.prepared_by_snapshot?.full_name || invoice.prepared_by || 'Authorized Officer';
  const prepDesig = invoice.prepared_by_snapshot?.designation || 'Executive';

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('PREPARED BY:', marginX, currentY);
  currentY += 4.5;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(prepName, marginX, currentY);
  currentY += 4;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(prepDesig, marginX, currentY);
  currentY += 3.8;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Thennakoon Tours (Pvt) Ltd', marginX, currentY);

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
