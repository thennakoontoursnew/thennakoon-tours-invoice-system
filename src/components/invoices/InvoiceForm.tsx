'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Save,
  FileText,
  Eye,
  Download,
  AlertCircle,
  Loader2,
  User,
  Car,
  Calculator,
  FileCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  Invoice,
  InvoiceItem,
  DeductionItem,
  Profile,
  CompanySettings,
  BankSettings,
  InvoiceSettings,
  QrSettings,
  InvoiceStatus,
} from '@/lib/types';
import { formatLKR } from '@/lib/utils';
import { downloadInvoicePdf } from '@/lib/pdf/generateInvoicePdf';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface InvoiceFormProps {
  initialInvoice?: Invoice | null;
  currentProfile: Profile;
  companySettings: CompanySettings;
  bankSettings: BankSettings;
  invoiceSettings: InvoiceSettings;
  qrSettings: QrSettings;
}

export function InvoiceForm({
  initialInvoice,
  currentProfile,
  companySettings,
  bankSettings,
  invoiceSettings,
  qrSettings,
}: InvoiceFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // User role permissions (normalized case-insensitive)
  const role = currentProfile?.role?.trim().toLowerCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const isDraftOnly = role === 'staff' && initialInvoice && initialInvoice.status !== 'Draft';

  // Helper date function
  const getDefaultDueDate = useCallback((dueDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (dueDays || 7));
    return d.toISOString().split('T')[0];
  }, []);

  // Section 1: Details
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    initialInvoice?.invoice_number || ''
  );
  const [isManualNumber, setIsManualNumber] = useState<boolean>(false);
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initialInvoice?.invoice_date || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    initialInvoice?.due_date || getDefaultDueDate(invoiceSettings.default_due_days || 7)
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    initialInvoice?.payment_terms || invoiceSettings.default_payment_terms || '7 Days'
  );
  const [status, setStatus] = useState<InvoiceStatus>(
    initialInvoice?.status || 'Draft'
  );
  const [quotationRef, setQuotationRef] = useState<string>(
    initialInvoice?.quotation_reference || ''
  );

  // Section 2: Customer
  const [customerName, setCustomerName] = useState<string>(
    initialInvoice?.customer_name || ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    initialInvoice?.customer_phone || ''
  );
  const [customerEmail, setCustomerEmail] = useState<string>(
    initialInvoice?.customer_email || ''
  );
  const [customerAddress, setCustomerAddress] = useState<string>(
    initialInvoice?.customer_address || ''
  );
  const [customerCompany, setCustomerCompany] = useState<string>(
    initialInvoice?.customer_company || ''
  );
  const [customerReference, setCustomerReference] = useState<string>(
    initialInvoice?.customer_reference || ''
  );

  // Section 3: Rental / Vehicle
  const [natureOfInvoice, setNatureOfInvoice] = useState<string>(
    initialInvoice?.nature_of_invoice || 'Vehicle Rental Service'
  );
  const [vehicleName, setVehicleName] = useState<string>(
    initialInvoice?.vehicle_name || ''
  );
  const [vehicleRegNo, setVehicleRegNo] = useState<string>(
    initialInvoice?.vehicle_registration_number || ''
  );
  const [rentalStartDate, setRentalStartDate] = useState<string>(
    initialInvoice?.rental_start_date || ''
  );
  const [rentalEndDate, setRentalEndDate] = useState<string>(
    initialInvoice?.rental_end_date || ''
  );
  const [rentalDays, setRentalDays] = useState<number>(
    initialInvoice?.rental_days || 1
  );
  const [destination, setDestination] = useState<string>(
    initialInvoice?.destination || ''
  );
  const [pickupLocation, setPickupLocation] = useState<string>(
    initialInvoice?.pickup_location || ''
  );
  const [dropoffLocation, setDropoffLocation] = useState<string>(
    initialInvoice?.dropoff_location || ''
  );

  // Section 4: Items
  const [items, setItems] = useState<InvoiceItem[]>(
    initialInvoice?.items_snapshot?.length
      ? initialInvoice.items_snapshot
      : [
          { description: 'Vehicle Rental', quantity: 1, unit_price: 15000, line_total: 15000 },
          { description: 'Refundable Deposit', quantity: 1, unit_price: 10000, line_total: 10000 },
        ]
  );

  // Section 5: Financial Adjustments
  const [discount, setDiscount] = useState<number>(initialInvoice?.discount || 0);
  const [deductionItems, setDeductionItems] = useState<DeductionItem[]>(
    initialInvoice?.deduction_items?.length
      ? initialInvoice.deduction_items
      : initialInvoice?.deduction && initialInvoice.deduction > 0
      ? [{ description: 'Deduction', amount: initialInvoice.deduction }]
      : []
  );
  const [taxRate, setTaxRate] = useState<number>(invoiceSettings.default_tax_rate || 0);
  const [advancePayment, setAdvancePayment] = useState<number>(initialInvoice?.advance_payment || 0);
  const [amountPaid, setAmountPaid] = useState<number>(initialInvoice?.amount_paid || 0);

  // Section 6: Notes
  const [specialNotes, setSpecialNotes] = useState<string>(
    initialInvoice?.special_notes ?? (invoiceSettings.default_special_notes || '')
  );
  const [importantNotes, setImportantNotes] = useState<string>(
    initialInvoice?.important_notes ?? (invoiceSettings.default_important_notes || '')
  );
  const [internalNotes, setInternalNotes] = useState<string>(
    initialInvoice?.internal_notes || ''
  );

  // Section 7: Prepared By
  const [preparedByName] = useState<string>(
    initialInvoice?.prepared_by_snapshot?.full_name ||
      initialInvoice?.prepared_by ||
      currentProfile.full_name
  );
  const [preparedByDesignation] = useState<string>(
    initialInvoice?.prepared_by_snapshot?.designation ||
      currentProfile.designation ||
      'Executive'
  );

  // Auto-generate Invoice Number on mount if new
  useEffect(() => {
    let isMounted = true;
    if (!initialInvoice && !invoiceNumber) {
      supabase.rpc('generate_next_invoice_number').then(({ data, error }) => {
        if (isMounted) {
          if (!error && data && data.length > 0) {
            setInvoiceNumber(data[0].new_invoice_number);
          } else {
            setInvoiceNumber('TT-IN-1001');
          }
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [initialInvoice, invoiceNumber, supabase]);

  // Handle Rental Date Changes with Day Calculation
  const handleStartDateChange = (val: string) => {
    setRentalStartDate(val);
    if (val && rentalEndDate) {
      const start = new Date(val).getTime();
      const end = new Date(rentalEndDate).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setRentalDays(days);
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setRentalEndDate(val);
    if (rentalStartDate && val) {
      const start = new Date(rentalStartDate).getTime();
      const end = new Date(val).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        setRentalDays(days);
      }
    }
  };

  // Real-time Calculations
  const subtotal = items.reduce((acc, curr) => acc + (curr.line_total || 0), 0);
  const taxAmount = (subtotal * (taxRate || 0)) / 100;

  const totalDeductions = deductionItems.reduce(
    (acc, curr) => acc + (curr.amount || 0),
    0
  );

  // Net Amount = Subtotal + Tax - Discount - Total Deductions - Advance Payment
  const calculatedNet = Math.max(
    0,
    subtotal + taxAmount - (discount || 0) - totalDeductions - (advancePayment || 0)
  );

  // Balance Due = Net Amount - Amount Paid
  const balanceDue = Math.max(0, calculatedNet - (amountPaid || 0));

  // Deduction item operations
  const addDeductionItem = () => {
    setDeductionItems([...deductionItems, { description: '', amount: 0 }]);
  };

  const removeDeductionItem = (index: number) => {
    setDeductionItems(deductionItems.filter((_, i) => i !== index));
  };

  const handleDeductionChange = (
    index: number,
    field: keyof DeductionItem,
    value: string | number
  ) => {
    const updated = [...deductionItems];
    const item = { ...updated[index] };
    if (field === 'description') {
      item.description = value as string;
    } else if (field === 'amount') {
      item.amount = Math.max(0, Number(value) || 0);
    }
    updated[index] = item;
    setDeductionItems(updated);
  };

  // Item row operations
  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    const updated = [...items];
    const item = { ...updated[index] };

    if (field === 'description') {
      item.description = value as string;
    } else if (field === 'quantity') {
      item.quantity = Math.max(0, Number(value) || 0);
      item.line_total = item.quantity * item.unit_price;
    } else if (field === 'unit_price') {
      item.unit_price = Math.max(0, Number(value) || 0);
      item.line_total = item.quantity * item.unit_price;
    }

    updated[index] = item;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { description: '', quantity: 1, unit_price: 0, line_total: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setNotification({
        type: 'error',
        message: 'Invoice must contain at least one item row.',
      });
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Status auto-determinator for finalized invoices
  const determineStatusOnSave = (currentStatus: InvoiceStatus): InvoiceStatus => {
    if (currentStatus === 'Cancelled') return 'Cancelled';
    if (currentStatus === 'Draft') return 'Draft';

    if (balanceDue === 0) return 'Paid';
    if ((amountPaid || 0) > 0 && balanceDue > 0) return 'Partially Paid';

    if (new Date(dueDate).getTime() < new Date().getTime() && balanceDue > 0) {
      return 'Overdue';
    }

    return 'Issued';
  };

  // Save handler
  const handleSaveInvoice = async (targetStatus: InvoiceStatus) => {
    if (!customerName.trim()) {
      setNotification({
        type: 'error',
        message: 'Customer Name is required.',
      });
      return;
    }

    if (!invoiceNumber.trim()) {
      setNotification({
        type: 'error',
        message: 'Invoice Number cannot be empty.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const finalStatus = determineStatusOnSave(targetStatus);
        const seqMatch = invoiceNumber.match(/\d+/);
        const parsedSeq = seqMatch ? parseInt(seqMatch[0], 10) : 1001;

        const validDeductionItems = deductionItems.filter(
          (d) => d.description.trim() !== '' || d.amount > 0
        );

        const invoicePayload = {
          invoice_number: invoiceNumber,
          invoice_sequence: parsedSeq,
          status: finalStatus,
          invoice_date: invoiceDate,
          due_date: dueDate,
          payment_terms: paymentTerms,
          quotation_reference: quotationRef,

          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_address: customerAddress,
          customer_company: customerCompany,
          customer_reference: customerReference,

          nature_of_invoice: natureOfInvoice,
          vehicle_name: vehicleName,
          vehicle_registration_number: vehicleRegNo,
          rental_start_date: rentalStartDate || null,
          rental_end_date: rentalEndDate || null,
          rental_days: rentalDays,
          destination: destination,
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,

          subtotal,
          discount,
          deduction: totalDeductions,
          deduction_items: validDeductionItems,
          tax_amount: taxAmount,
          advance_payment: advancePayment,
          net_amount: calculatedNet,
          amount_paid: amountPaid,
          balance_due: balanceDue,

          special_notes: specialNotes,
          important_notes: importantNotes,
          internal_notes: internalNotes,

          items_snapshot: items,
          company_snapshot: companySettings,
          bank_snapshot: bankSettings,
          qr_snapshot: qrSettings,
          prepared_by: preparedByName,
          prepared_by_snapshot: {
            full_name: preparedByName,
            designation: preparedByDesignation,
            email: currentProfile.email,
          },

          updated_by: currentProfile.id,
        };

        if (initialInvoice?.id) {
          const { error } = await supabase
            .from('invoices')
            .update(invoicePayload)
            .eq('id', initialInvoice.id);

          if (error) throw error;

          await supabase.from('invoice_activity_logs').insert({
            invoice_id: initialInvoice.id,
            user_id: currentProfile.id,
            user_name: currentProfile.full_name,
            action: 'edited',
            details: { status: finalStatus },
          });

          setNotification({
            type: 'success',
            message: `Invoice ${invoiceNumber} updated successfully.`,
          });
        } else {
          const { data, error } = await supabase
            .from('invoices')
            .insert({
              ...invoicePayload,
              created_by: currentProfile.id,
            })
            .select('id')
            .single();

          if (error) throw error;

          if (data?.id) {
            await supabase.from('invoice_activity_logs').insert({
              invoice_id: data.id,
              user_id: currentProfile.id,
              user_name: currentProfile.full_name,
              action: 'created',
              details: { status: finalStatus },
            });
          }

          setNotification({
            type: 'success',
            message: `Invoice ${invoiceNumber} created successfully!`,
          });

          setTimeout(() => {
            router.push('/invoices');
          }, 1200);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save invoice.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  const currentInvoicePreviewObject: Invoice = {
    id: initialInvoice?.id || 'preview-id',
    invoice_number: invoiceNumber || 'TT-IN-1001',
    invoice_sequence: 1001,
    status,
    invoice_date: invoiceDate,
    due_date: dueDate,
    payment_terms: paymentTerms,
    quotation_reference: quotationRef,
    customer_name: customerName || 'Valued Customer',
    customer_phone: customerPhone,
    customer_email: customerEmail,
    customer_address: customerAddress,
    customer_company: customerCompany,
    customer_reference: customerReference,
    nature_of_invoice: natureOfInvoice,
    vehicle_name: vehicleName,
    vehicle_registration_number: vehicleRegNo,
    rental_start_date: rentalStartDate,
    rental_end_date: rentalEndDate,
    rental_days: rentalDays,
    destination: destination,
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
    subtotal,
    discount,
    deduction: totalDeductions,
    deduction_items: deductionItems,
    tax_amount: taxAmount,
    advance_payment: advancePayment,
    net_amount: calculatedNet,
    amount_paid: amountPaid,
    balance_due: balanceDue,
    special_notes: specialNotes,
    important_notes: importantNotes,
    internal_notes: internalNotes,
    items_snapshot: items,
    company_snapshot: companySettings,
    bank_snapshot: bankSettings,
    qr_snapshot: qrSettings,
    prepared_by: preparedByName,
    prepared_by_snapshot: {
      full_name: preparedByName,
      designation: preparedByDesignation,
      email: currentProfile.email,
    },
    created_at: initialInvoice?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-lg">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
            {initialInvoice ? 'Edit Existing Record' : 'New Creation'}
          </span>
          <h1 className="text-xl font-extrabold text-white">
            {initialInvoice ? `Invoice ${invoiceNumber}` : 'Create New Invoice'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Preview PDF</span>
          </button>

          <button
            type="button"
            onClick={() => downloadInvoicePdf(currentInvoicePreviewObject)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-amber-400 text-xs font-semibold border border-zinc-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>

          {!isDraftOnly && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSaveInvoice('Draft')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save as Draft</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSaveInvoice(status === 'Draft' ? 'Issued' : status)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                <span>Finalize & Issue</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isDraftOnly && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Staff members can edit Draft invoices only. Finalized invoices are locked for editing.</span>
        </div>
      )}

      {/* SECTION 1: INVOICE DETAILS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <FileText className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Section 1 — Invoice Metadata
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Invoice Number <span className="text-amber-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                disabled={!isOwnerOrAdmin && !isManualNumber}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-80"
              />
              {isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsManualNumber(!isManualNumber)}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 border border-zinc-700"
                >
                  {isManualNumber ? 'Auto' : 'Edit'}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Payment Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="Immediate">Immediate / Cash</option>
              <option value="7 Days">7 Days</option>
              <option value="14 Days">14 Days</option>
              <option value="30 Days">30 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Invoice Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-amber-400 focus:outline-none focus:border-amber-500"
            >
              <option value="Draft">Draft</option>
              <option value="Issued">Issued</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Quotation Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. TT-QT-2026-0042"
              value={quotationRef}
              onChange={(e) => setQuotationRef(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: CUSTOMER DETAILS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <User className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Section 2 — Customer Details
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Customer Name <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Full Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="+94 7X XXX XXXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="customer@domain.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Company Name
            </label>
            <input
              type="text"
              placeholder="Optional Corporate Name"
              value={customerCompany}
              onChange={(e) => setCustomerCompany(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Customer Reference
            </label>
            <input
              type="text"
              placeholder="NIC / Passport / Client ID"
              value={customerReference}
              onChange={(e) => setCustomerReference(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Customer Billing Address
            </label>
            <input
              type="text"
              placeholder="Street, City, Country"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: RENTAL / VEHICLE DETAILS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Car className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Section 3 — Rental & Vehicle Info
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Nature of Invoice
            </label>
            <input
              type="text"
              value={natureOfInvoice}
              onChange={(e) => setNatureOfInvoice(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Vehicle Name / Model
            </label>
            <input
              type="text"
              placeholder="e.g. Toyota KDH High Roof"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Registration Number
            </label>
            <input
              type="text"
              placeholder="e.g. WP CAR-1234"
              value={vehicleRegNo}
              onChange={(e) => setVehicleRegNo(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Rental Start Date
            </label>
            <input
              type="date"
              value={rentalStartDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Rental End Date
            </label>
            <input
              type="date"
              value={rentalEndDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Number of Rental Days
            </label>
            <input
              type="number"
              min={1}
              value={rentalDays}
              onChange={(e) => setRentalDays(Number(e.target.value) || 1)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Pickup Location
            </label>
            <input
              type="text"
              placeholder="e.g. BIA Airport / Colombo"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Destination
            </label>
            <input
              type="text"
              placeholder="e.g. Kandy / Sigiriya Round Trip"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Drop-off Location
            </label>
            <input
              type="text"
              placeholder="e.g. Colombo Hotel"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: DYNAMIC INVOICE ITEMS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Section 4 — Invoice Line Items
            </h2>
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item Row</span>
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg bg-zinc-950/80 border border-zinc-850"
            >
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-[10px] text-zinc-500 mb-0.5 sm:hidden">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="block text-[10px] text-zinc-500 mb-0.5 sm:hidden">
                  Qty
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-center text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="block text-[10px] text-zinc-500 mb-0.5 sm:hidden">
                  Unit Price
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={item.unit_price}
                  onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-right text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="col-span-3 sm:col-span-2 text-right">
                <span className="block text-[10px] text-zinc-500 mb-0.5 sm:hidden">
                  Line Total
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {formatLKR(item.line_total)}
                </span>
              </div>

              <div className="col-span-1 text-right">
                <button
                  type="button"
                  onClick={() => removeItemRow(idx)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: PAYMENT SUMMARY */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Calculator className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Section 5 — Payment & Financial Summary
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Financial Adjustments */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Discount Amount (LKR)
              </label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Dynamic Deductions Section */}
            <div className="pt-2 pb-2 border-t border-b border-zinc-850 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Deductions (Optional)
                </label>
                <button
                  type="button"
                  onClick={addDeductionItem}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-semibold transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Deduction</span>
                </button>
              </div>

              {deductionItems.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic">
                  No deductions added. Click &quot;Add Deduction&quot; to specify damage, fuel, or late fee deductions.
                </p>
              ) : (
                <div className="space-y-2">
                  {deductionItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Damage / Fuel / Adjustment"
                        value={item.description}
                        onChange={(e) => handleDeductionChange(idx, 'description', e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Amount"
                        value={item.amount || ''}
                        onChange={(e) => handleDeductionChange(idx, 'amount', e.target.value)}
                        className="w-28 bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-right font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeDeductionItem(idx)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Tax Percentage (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Advance Payment Received (LKR)
              </label>
              <input
                type="number"
                min={0}
                value={advancePayment}
                onChange={(e) => setAdvancePayment(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Amount Paid (LKR)
              </label>
              <input
                type="number"
                min={0}
                max={calculatedNet}
                value={amountPaid}
                onChange={(e) => setAmountPaid(Math.min(calculatedNet, Math.max(0, Number(e.target.value) || 0)))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Right Column: Real-time Calculation Table */}
          <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-zinc-850 pb-2">
              Financial Breakdown
            </h3>

            <div className="flex justify-between text-xs text-zinc-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-zinc-200">{formatLKR(subtotal)}</span>
            </div>

            {taxAmount > 0 && (
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Tax ({taxRate}%):</span>
                <span className="font-semibold text-zinc-200">+ {formatLKR(taxAmount)}</span>
              </div>
            )}

            {discount > 0 && (
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Discount:</span>
                <span className="font-semibold text-red-400">- {formatLKR(discount)}</span>
              </div>
            )}

            {deductionItems.map((d, i) => (
              <div key={i} className="flex justify-between text-xs text-zinc-400">
                <span>{d.description || 'Deduction'}:</span>
                <span className="font-semibold text-red-400">- {formatLKR(d.amount)}</span>
              </div>
            ))}

            {deductionItems.length > 1 && totalDeductions > 0 && (
              <div className="flex justify-between text-xs font-bold text-red-400 border-t border-zinc-850/60 pt-1">
                <span>Total Deductions:</span>
                <span>- {formatLKR(totalDeductions)}</span>
              </div>
            )}

            {advancePayment > 0 && (
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Advance Payment:</span>
                <span className="font-semibold text-amber-400">- {formatLKR(advancePayment)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-white border-t border-zinc-850 pt-2">
              <span>Net Amount:</span>
              <span>{formatLKR(calculatedNet)}</span>
            </div>

            <div className="flex justify-between text-xs text-zinc-400">
              <span>Amount Paid:</span>
              <span className="font-semibold text-emerald-400">- {formatLKR(amountPaid)}</span>
            </div>

            <div className="flex justify-between text-base font-black text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/30">
              <span>Balance Due:</span>
              <span>{formatLKR(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: NOTES */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <FileText className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Section 6 — Special & Important Notes
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Special Notes
            </label>
            <textarea
              rows={2}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Important Terms & Conditions Note
            </label>
            <textarea
              rows={3}
              value={importantNotes}
              onChange={(e) => setImportantNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Internal Notes (Visible to Staff only, not printed on PDF)
            </label>
            <input
              type="text"
              placeholder="Private staff comments"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 7: PREPARED BY */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
            Section 7 — Prepared By
          </span>
          <p className="text-sm font-bold text-white mt-0.5">{preparedByName}</p>
          <p className="text-xs text-amber-400">{preparedByDesignation} — Thennakoon Tours (Pvt) Ltd</p>
        </div>

        <div className="text-right text-xs text-zinc-500">
          Auto-defaulted from active user session profile
        </div>
      </div>

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={currentInvoicePreviewObject}
        onError={(msg) => setNotification({ type: 'error', message: msg })}
      />
    </div>
  );
}
