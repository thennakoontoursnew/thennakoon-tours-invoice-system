# Thennakoon Tours Invoice Generator

A standalone, high-performance web application built specifically for **Thennakoon Tours (Pvt) Ltd** to quickly generate, save, preview, download, and manage professional PDF invoices.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI & Styling**: Tailwind CSS, Lucide Icons, Custom Dark Theme (`#09090b` background, `#eab308` gold accent)
- **Database & Auth**: Supabase PostgreSQL & Supabase SSR Auth
- **PDF Engine**: `jsPDF` and `jspdf-autotable`
- **Form Validation**: React Hook Form & Zod

---

## Features

1. **Role-Based Access Control**:
   - **Owner**: Full system access, manage users, settings, create, edit, download, archive, and restore invoices.
   - **Admin**: Create and edit invoices, manage settings, preview/download PDFs, change invoice status, archive/restore.
   - **Staff**: Create invoices, edit Draft invoices, view invoice history, preview and download PDFs. Cannot access user management or system settings.

2. **Atomic Invoice Numbering**:
   - Database sequence function generates `TT-IN-YYYY-XXXX` automatically.
   - Resets per calendar year cleanly.
   - Safe against concurrent user creation.
   - Owner and Admin manual override option with uniqueness checks.

3. **Real-time Financial Calculations**:
   - Subtotal = Sum of Item Totals (Quantity × Unit Price).
   - Net Amount = Subtotal + Tax - Discount - Deduction - Advance Payment.
   - Balance Due = Net Amount - Amount Paid.
   - Formatted in **LKR** with thousand separators and non-negative total enforcement.

4. **Professional A4 PDF Generator**:
   - Formatted against official Thennakoon Tours letterhead background.
   - Safe print margin boundaries so artwork is never covered.
   - Includes item breakdown table, bank details, QR code, special & important notes, and Prepared By signature block.
   - Generates formatted filename: `TT-Invoice-TT-IN-2026-0001-Customer-Name.pdf`.

5. **Invoice History & Search**:
   - Search by Invoice #, Customer Name, Phone Number, or Vehicle Registration.
   - Filter by status and date range.
   - Single-click duplication (creates new Draft with reset dates & new number).
   - Soft archive and restore for full data retention.

---

## Supabase Database Setup & Migrations

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and create a new project (or select an existing one).
2. Navigate to **SQL Editor**.
3. Copy the contents of [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) and run the query.
4. This script will automatically create:
   - Tables (`profiles`, `invoices`, `invoice_items`, `invoice_number_sequences`, `company_settings`, `bank_settings`, `invoice_settings`, `qr_settings`, `invoice_activity_logs`).
   - Sequence function `generate_next_invoice_number(p_year)`.
   - Triggers for `updated_at` and automatic profile creation on auth signup.
   - Row Level Security (RLS) policies for Owner, Admin, and Staff roles.

---

## Storage Setup Instructions

1. Go to **Storage** in your Supabase Dashboard.
2. Create a public bucket named `invoice-assets`.
3. Set policy to allow authenticated users to upload and public users to view assets (letterheads, QR images).
4. Alternatively, use static assets stored in `/public/documents/` (such as `/documents/thennakoon-tours-letterhead.png`).

---

## Initial Owner Account Setup

1. Deploy or start the application locally (`npm run dev`).
2. Navigate to `http://localhost:3000/owner-setup`.
3. Fill in the Owner setup form (Full Name, Email, Password, Designation).
4. Upon submission, the database trigger assigns the initial user as **Owner**.
5. The page automatically locks and redirects to `/login`.
6. Subsequent visits to `/owner-setup` will automatically redirect to `/login`.

---

## Local Setup Guide

1. Clone the repository:
   ```bash
   git clone https://github.com/thennakoontoursnew/thennakoon-tours-invoice-system.git
   cd thennakoon-tours-invoice-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run local development server:
   ```bash
   npm run dev
   ```

5. Access app at `http://localhost:3000`.

---

## Vercel Deployment Guide

1. Push code to GitHub repository:
   `https://github.com/thennakoontoursnew/thennakoon-tours-invoice-system.git`
2. Import project into [Vercel](https://vercel.com).
3. Set Framework Preset to **Next.js**.
4. Configure Environment Variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**.

---

## Verification & Testing Checklist

- [x] Owner setup redirect on first initialization
- [x] Login authentication with Supabase SSR
- [x] Automatic invoice number sequence generation (`TT-IN-2026-0001`)
- [x] Dynamic item rows (Qty × Price calculation)
- [x] LKR Currency formatting with thousand separators
- [x] Net Amount and Balance Due real-time calculations
- [x] Draft saving and finalization status rules
- [x] A4 PDF preview modal and direct PDF download with letterhead background
- [x] Invoice history search, status filtering, and date range filtering
- [x] Invoice duplication with reset payments and new number
- [x] Archive and restore capabilities for Owner/Admin
- [x] System settings update (Company, Bank, QR, Letterhead, Default Notes)
- [x] User management table and role assignment (Owner only)

---

## Known Limitations

- Letterhead image rendering in PDF requires a CORS-accessible public URL or local static asset path (`/documents/thennakoon-tours-letterhead.png`).
- Email and WhatsApp direct dispatch are excluded from this phase as requested.
