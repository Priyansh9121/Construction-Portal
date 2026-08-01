-- ===========================================================================
-- Construction Portal — Migration 001: Schema upgrade
-- ===========================================================================
--
-- WHAT THIS DOES
--   1. Creates the tables the application code queries but that do not exist
--      (daily_update_approvals, tender_workers) — these currently throw
--      PostgreSQL 42P01 "relation does not exist" at runtime.
--   2. Adds company_id to every tenant-owned table that lacks it, so that
--      multi-tenant isolation can be enforced uniformly (and via RLS).
--   3. Adds the operational tables described in the operations notebook:
--      material catalog + daily material entries, labour ledger, supervisor
--      banking, and the late-entry access-request workflow.
--   4. Extends `payments` with the columns the Add-Payment hierarchy needs.
--
-- SAFETY
--   Fully idempotent — every statement is IF NOT EXISTS / guarded in a
--   DO block. Safe to run more than once.
--   Runs inside a single transaction: if anything fails, nothing is applied.
--
-- HOW TO RUN
--   Local (pgAdmin 4):  open this file in the Query Tool against your
--                       `construction_portal` database and execute.
--   Local (psql):       psql "$DATABASE_URL" -f 001_upgrade_schema.sql
--   Supabase:           SQL Editor → paste → Run. (Run 002 first if the
--                       project is empty.)
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ===========================================================================
-- 1. MISSING TABLES — queried by live code, absent from the database
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1.1  daily_update_approvals
--
-- Queried by:
--   modules/dailyUpdateApprovals/dailyUpdateApproval.controller.js
--   modules/workerPortal/workerPortal.controller.js:290
--   modules/subcontractorPortal/subcontractorPortal.controller.js:316
--
-- Workers and subcontractors submit a daily update here; an admin approves it
-- and the approved row is copied into daily_site_logs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_update_approvals (
    id                BIGSERIAL PRIMARY KEY,
    company_id        INTEGER      NOT NULL
                      REFERENCES public.companies (id) ON DELETE CASCADE,

    tender_id         INTEGER      REFERENCES public.tenders (id)        ON DELETE SET NULL,
    site_id           INTEGER      REFERENCES public.sites (id)          ON DELETE SET NULL,
    worker_id         INTEGER      REFERENCES public.workers (id)        ON DELETE SET NULL,
    subcontractor_id  INTEGER      REFERENCES public.subcontractors (id) ON DELETE SET NULL,

    submitted_by      INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    log_date          DATE         NOT NULL,
    notes             TEXT         NOT NULL DEFAULT '',
    photo_url         TEXT,

    -- Provenance for the photo — the notes require the office to be able to
    -- tell a live camera capture from a gallery re-upload.
    photo_source      VARCHAR(20)  NOT NULL DEFAULT 'unknown'
                      CHECK (photo_source IN ('camera', 'gallery', 'unknown')),
    photo_captured_at TIMESTAMPTZ,

    status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment     TEXT,
    reviewed_by       INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    reviewed_at       TIMESTAMPTZ,
    approved_log_id   INTEGER      REFERENCES public.daily_site_logs (id) ON DELETE SET NULL,

    is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    deleted_by        INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- A submission must come from either a worker or a subcontractor.
    CONSTRAINT daily_update_approvals_author_present
        CHECK (worker_id IS NOT NULL OR subcontractor_id IS NOT NULL)
);

-- Columns the existing controller selects by name. Added separately from the
-- CREATE TABLE above so this file stays correct when the table already
-- exists from an earlier run.
ALTER TABLE public.daily_update_approvals
    -- Why the update needs review (late submission, backdated entry, ...).
    ADD COLUMN IF NOT EXISTS reason       TEXT,
    ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS approved_by  INTEGER REFERENCES public.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_by  INTEGER REFERENCES public.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejected_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dua_company_status
    ON public.daily_update_approvals (company_id, status)
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_dua_worker
    ON public.daily_update_approvals (worker_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_dua_subcontractor
    ON public.daily_update_approvals (subcontractor_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_dua_tender
    ON public.daily_update_approvals (tender_id, log_date DESC);


-- ---------------------------------------------------------------------------
-- 1.2  tender_workers
--
-- Queried by modules/workerPortal/workerPortal.controller.js (lines 44, 131,
-- 389) and the /api/tender-workers routes.
--
-- NOTE: worker_assignments already exists and is site-centric. tender_workers
-- is the tender-centric assignment the worker portal is written against, and
-- carries site_id directly — the portal code currently tries to read
-- `tenders.site_id`, which does not exist (sites reference tenders, not the
-- reverse). Backend query fixes accompany this migration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tender_workers (
    id            BIGSERIAL PRIMARY KEY,
    company_id    INTEGER     NOT NULL
                  REFERENCES public.companies (id) ON DELETE CASCADE,
    tender_id     INTEGER     NOT NULL
                  REFERENCES public.tenders (id) ON DELETE CASCADE,
    worker_id     INTEGER     NOT NULL
                  REFERENCES public.workers (id) ON DELETE CASCADE,
    site_id       INTEGER     REFERENCES public.sites (id) ON DELETE SET NULL,

    -- 'supervisor' unlocks the supervisor screens in the worker portal
    -- (material data, banking, labour) described in the notes.
    assignment_role VARCHAR(30) NOT NULL DEFAULT 'worker'
                    CHECK (assignment_role IN ('worker', 'supervisor', 'engineer', 'operator')),

    status        VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'removed')),
    daily_rate    NUMERIC(12, 2),
    notes         TEXT,

    assigned_by   INTEGER     REFERENCES public.users (id) ON DELETE SET NULL,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at      TIMESTAMPTZ,

    is_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    deleted_by    INTEGER     REFERENCES public.users (id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active assignment per worker per tender.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tender_workers_active
    ON public.tender_workers (tender_id, worker_id)
    WHERE is_deleted = FALSE AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_tender_workers_worker
    ON public.tender_workers (worker_id, status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_tender_workers_company
    ON public.tender_workers (company_id) WHERE is_deleted = FALSE;


-- ===========================================================================
-- 2. TENANT ISOLATION — add company_id where it is missing
--
-- These tables currently have no company_id, which is why the controllers
-- that touch them cannot filter by tenant. The database is empty, so the
-- backfill below is a no-op today and costs nothing; it will not be free
-- once real data exists.
-- ===========================================================================

ALTER TABLE public.worker_allocations      ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.worker_expenses         ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.worker_assignments      ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.tender_banking          ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.tender_documents        ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.tender_materials        ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.tender_subcontractors   ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE public.tender_finance_records  ADD COLUMN IF NOT EXISTS company_id INTEGER;

-- Backfill from the owning parent row.
UPDATE public.worker_allocations wa
   SET company_id = w.company_id
  FROM public.workers w
 WHERE w.id = wa.worker_id AND wa.company_id IS NULL;

UPDATE public.worker_expenses we
   SET company_id = wa.company_id
  FROM public.worker_allocations wa
 WHERE wa.id = we.allocation_id AND we.company_id IS NULL;

UPDATE public.worker_assignments wasg
   SET company_id = w.company_id
  FROM public.workers w
 WHERE w.id = wasg.worker_id AND wasg.company_id IS NULL;

UPDATE public.tender_banking tb
   SET company_id = t.company_id
  FROM public.tenders t
 WHERE t.id = tb.tender_id AND tb.company_id IS NULL;

UPDATE public.tender_documents td
   SET company_id = t.company_id
  FROM public.tenders t
 WHERE t.id = td.tender_id AND td.company_id IS NULL;

UPDATE public.tender_materials tm
   SET company_id = t.company_id
  FROM public.tenders t
 WHERE t.id = tm.tender_id AND tm.company_id IS NULL;

UPDATE public.tender_subcontractors ts
   SET company_id = t.company_id
  FROM public.tenders t
 WHERE t.id = ts.tender_id AND ts.company_id IS NULL;

UPDATE public.tender_finance_records tfr
   SET company_id = t.company_id
  FROM public.tenders t
 WHERE t.id = tfr.tender_id AND tfr.company_id IS NULL;

-- Enforce NOT NULL + FK, but only once every row has a value. If any row is
-- still NULL (orphaned child), the constraint is skipped and a warning is
-- raised rather than failing the whole migration.
DO $$
DECLARE
    t   TEXT;
    n   BIGINT;
    tbl TEXT[] := ARRAY[
        'worker_allocations', 'worker_expenses', 'worker_assignments',
        'tender_banking', 'tender_documents', 'tender_materials',
        'tender_subcontractors', 'tender_finance_records'
    ];
BEGIN
    FOREACH t IN ARRAY tbl LOOP
        EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id IS NULL', t) INTO n;

        IF n > 0 THEN
            RAISE WARNING
                'Skipping NOT NULL on %.company_id — % orphaned row(s) could not be backfilled. Resolve then re-run.',
                t, n;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conname = format('%s_company_id_fkey', t)
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I
                     FOREIGN KEY (company_id) REFERENCES public.companies (id) ON DELETE CASCADE',
                t, format('%s_company_id_fkey', t)
            );
        END IF;

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)',
            format('idx_%s_company', t), t
        );
    END LOOP;
END $$;


-- ===========================================================================
-- 3. PAYMENTS — extend for the Add-Payment hierarchy
--
-- The payments table already carries payment_scope, payment_sub_type,
-- interest_percent, fd_site, collected_gst, company_charge_percent and
-- tds_amount. These are the remaining fields the notes require.
-- ===========================================================================

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS payment_direction     VARCHAR(10),
    ADD COLUMN IF NOT EXISTS investor_id           INTEGER REFERENCES public.investors (id)  ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supplier_id           INTEGER REFERENCES public.suppliers (id)  ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS client_id             INTEGER REFERENCES public.clients (id)    ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS subcontractor_id      INTEGER REFERENCES public.subcontractors (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS labour_id             BIGINT,
    -- "BVN1460" in the worked example on page 4 of the notes.
    ADD COLUMN IF NOT EXISTS bill_number           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bill_amount           NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS charge_amount         NUMERIC(14, 2),
    -- મળેલ GST (received) vs બાકી GST (remaining) from page 4.
    ADD COLUMN IF NOT EXISTS gst_received          NUMERIC(14, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gst_left              NUMERIC(14, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS company_charge_left   NUMERIC(14, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS company_charge_done   NUMERIC(14, 2) DEFAULT 0,
    -- Interest accrual for investor money (page 2: "how many % interest, and
    -- keep the extra per-day interest recorded").
    ADD COLUMN IF NOT EXISTS interest_amount       NUMERIC(14, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interest_accrued_to   DATE,
    ADD COLUMN IF NOT EXISTS source_type           VARCHAR(30),
    ADD COLUMN IF NOT EXISTS approval_status       VARCHAR(20) NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS approved_by           INTEGER REFERENCES public.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at           TIMESTAMPTZ;

-- Derive direction from the existing payment_type for rows created before
-- this column existed.
UPDATE public.payments
   SET payment_direction = CASE
        WHEN lower(payment_type) IN ('income', 'credit', 'in')  THEN 'income'
        ELSE 'expense'
   END
 WHERE payment_direction IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_direction_check'
    ) THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT payments_direction_check
            CHECK (payment_direction IN ('income', 'expense'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_company_direction_date
    ON public.payments (company_id, payment_direction, payment_date DESC)
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_scope
    ON public.payments (company_id, payment_scope, payment_sub_type)
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_tender
    ON public.payments (tender_id) WHERE is_deleted = FALSE;


-- ===========================================================================
-- 4. OPERATIONS — tables from the worker/supervisor notebook
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 4.1  material_catalog  (notebook page 02 — "Main Section")
--
-- The fixed list of materials a supervisor picks from: કપચી (aggregate),
-- રેતી (sand), સિમેન્ટ (cement), ડામર (bitumen), ટાઇલ્સ (tiles),
-- લોખંડ (steel), ઈંટ (brick), બ્લોક (block), and free-text "other".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_catalog (
    id           SERIAL PRIMARY KEY,
    company_id   INTEGER     NOT NULL
                 REFERENCES public.companies (id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL,
    name_local   VARCHAR(120),
    main_section VARCHAR(60)  NOT NULL DEFAULT 'other',
    unit         VARCHAR(20)  NOT NULL DEFAULT 'unit',
    hsn_code     VARCHAR(20),
    default_gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_material_catalog_company_name
    ON public.material_catalog (company_id, lower(name));


-- ---------------------------------------------------------------------------
-- 4.2  site_material_entries  (notebook pages 02–03)
--
-- "Whatever quantity of the above arrives each day is added with its rate and
--  bill. Keep a photo-upload option too."
-- "Keep an option to add the material photo from gallery OR direct camera —
--  the company must be able to tell whether the photo is current or was
--  uploaded from the gallery."
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_material_entries (
    id                BIGSERIAL PRIMARY KEY,
    company_id        INTEGER      NOT NULL
                      REFERENCES public.companies (id) ON DELETE CASCADE,
    tender_id         INTEGER      REFERENCES public.tenders (id)  ON DELETE SET NULL,
    site_id           INTEGER      REFERENCES public.sites (id)    ON DELETE SET NULL,
    material_id       INTEGER      REFERENCES public.material_catalog (id) ON DELETE SET NULL,
    -- Denormalised so history survives a catalog rename/delete.
    material_name     VARCHAR(120) NOT NULL,
    main_section      VARCHAR(60),

    entry_date        DATE         NOT NULL,
    quantity          NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
    unit              VARCHAR(20)  NOT NULL DEFAULT 'unit',
    rate              NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
    amount            NUMERIC(14, 2) NOT NULL DEFAULT 0,
    gst_percent       NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    gst_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,

    supplier_id       INTEGER      REFERENCES public.suppliers (id) ON DELETE SET NULL,
    supplier_name     VARCHAR(160),
    bill_number       VARCHAR(100),
    bill_url          TEXT,
    vehicle_number    VARCHAR(40),

    -- Photo provenance — the office needs to distinguish a live capture from
    -- a gallery re-upload.
    photo_url         TEXT,
    photo_source      VARCHAR(20)  NOT NULL DEFAULT 'unknown'
                      CHECK (photo_source IN ('camera', 'gallery', 'unknown')),
    photo_captured_at TIMESTAMPTZ,
    photo_exif        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    photo_is_verified BOOLEAN      NOT NULL DEFAULT FALSE,

    recorded_by       INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    -- Set when the entry was backdated beyond the normal window using a
    -- granted access request.
    access_request_id BIGINT,

    approval_status   VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    admin_comment     TEXT,
    approved_by       INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    approved_at       TIMESTAMPTZ,

    is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    deleted_by        INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sme_company_date
    ON public.site_material_entries (company_id, entry_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_sme_tender
    ON public.site_material_entries (tender_id, entry_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_sme_approval
    ON public.site_material_entries (company_id, approval_status) WHERE is_deleted = FALSE;


-- ---------------------------------------------------------------------------
-- 4.3  labour  (notebook page 05 — "લિબરકામ")
--
-- "A list of labourers that the supervisor adds by name for those working
--  under them" — with a work-type label such as કડિયા (mason), પ્લાસ્ટર
--  (plasterer), છત કામ (roofing).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.labour (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         INTEGER      NOT NULL
                       REFERENCES public.companies (id) ON DELETE CASCADE,
    tender_id          INTEGER      REFERENCES public.tenders (id) ON DELETE SET NULL,
    site_id            INTEGER      REFERENCES public.sites (id)   ON DELETE SET NULL,
    -- The supervisor who owns this labourer's ledger.
    supervisor_user_id INTEGER      REFERENCES public.users (id)   ON DELETE SET NULL,
    worker_id          INTEGER      REFERENCES public.workers (id) ON DELETE SET NULL,

    full_name          VARCHAR(160) NOT NULL,
    phone              VARCHAR(30),
    -- kadiya | plaster | chhat | helper | centering | painter | other
    category           VARCHAR(60)  NOT NULL DEFAULT 'other',
    category_local     VARCHAR(60),
    daily_rate         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),

    status             VARCHAR(20)  NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'inactive')),
    notes              TEXT,

    created_by         INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    is_deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMPTZ,
    deleted_by         INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labour_company
    ON public.labour (company_id, status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labour_supervisor
    ON public.labour (supervisor_user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_labour_tender
    ON public.labour (tender_id) WHERE is_deleted = FALSE;

-- payments.labour_id FK, now that labour exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_labour_id_fkey'
    ) THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT payments_labour_id_fkey
            FOREIGN KEY (labour_id) REFERENCES public.labour (id) ON DELETE SET NULL;
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4.4  labour_work_entries  (notebook page 05)
--
-- "Each labourer has an account here — how many rupees were paid to them
--  each day."  Clicking a labourer opens their running total.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.labour_work_entries (
    id                BIGSERIAL PRIMARY KEY,
    company_id        INTEGER      NOT NULL
                      REFERENCES public.companies (id) ON DELETE CASCADE,
    labour_id         BIGINT       NOT NULL
                      REFERENCES public.labour (id) ON DELETE CASCADE,
    tender_id         INTEGER      REFERENCES public.tenders (id) ON DELETE SET NULL,
    site_id           INTEGER      REFERENCES public.sites (id)   ON DELETE SET NULL,

    work_date         DATE         NOT NULL,
    -- 0.5 = half day, 1 = full day, 1.5 = day + overtime
    days_worked       NUMERIC(5, 2) NOT NULL DEFAULT 1 CHECK (days_worked >= 0),
    hours_worked      NUMERIC(5, 2),
    rate              NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rate >= 0),
    wage_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_paid       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    -- Running unpaid balance, so "કામ બાકી" (work outstanding) is visible.
    balance_amount    NUMERIC(14, 2) NOT NULL DEFAULT 0,

    work_description  TEXT,
    payment_mode      VARCHAR(20)  NOT NULL DEFAULT 'cash'
                      CHECK (payment_mode IN ('cash', 'bank', 'upi', 'pending')),

    recorded_by       INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    access_request_id BIGINT,

    approval_status   VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    admin_comment     TEXT,
    approved_by       INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    approved_at       TIMESTAMPTZ,

    is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMPTZ,
    deleted_by        INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lwe_labour_date
    ON public.labour_work_entries (labour_id, work_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lwe_company_date
    ON public.labour_work_entries (company_id, work_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lwe_approval
    ON public.labour_work_entries (company_id, approval_status) WHERE is_deleted = FALSE;


-- ---------------------------------------------------------------------------
-- 4.5  supervisor_fund_receipts  (notebook page 04 — "બેંકિંગ")
--
-- "The supervisor receives money in 3 ways: into the bank account, as cash,
--  and as GST-paid cash."
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supervisor_fund_receipts (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         INTEGER      NOT NULL
                       REFERENCES public.companies (id) ON DELETE CASCADE,
    tender_id          INTEGER      REFERENCES public.tenders (id) ON DELETE SET NULL,
    site_id            INTEGER      REFERENCES public.sites (id)   ON DELETE SET NULL,
    supervisor_user_id INTEGER      NOT NULL
                       REFERENCES public.users (id) ON DELETE CASCADE,

    receipt_date       DATE         NOT NULL,
    -- bank | cash | gst_cash  (the three routes from the notes)
    receipt_type       VARCHAR(20)  NOT NULL
                       CHECK (receipt_type IN ('bank', 'cash', 'gst_cash')),
    amount             NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    reference_number   VARCHAR(100),
    bank_name          VARCHAR(120),
    notes              TEXT,
    receipt_url        TEXT,

    issued_by          INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    payment_id         INTEGER      REFERENCES public.payments (id) ON DELETE SET NULL,

    is_deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMPTZ,
    deleted_by         INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sfr_supervisor_date
    ON public.supervisor_fund_receipts (supervisor_user_id, receipt_date DESC)
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_sfr_company
    ON public.supervisor_fund_receipts (company_id, receipt_date DESC)
    WHERE is_deleted = FALSE;


-- ---------------------------------------------------------------------------
-- 4.6  supervisor_expenses  (notebook page 04)
--
-- "Whatever the supervisor spends each day, or any wages they pay out, all of
--  it must be added daily."
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supervisor_expenses (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         INTEGER      NOT NULL
                       REFERENCES public.companies (id) ON DELETE CASCADE,
    tender_id          INTEGER      REFERENCES public.tenders (id) ON DELETE SET NULL,
    site_id            INTEGER      REFERENCES public.sites (id)   ON DELETE SET NULL,
    supervisor_user_id INTEGER      NOT NULL
                       REFERENCES public.users (id) ON DELETE CASCADE,

    expense_date       DATE         NOT NULL,
    -- material | labour | fuel | fastag | transport | food | tools | other
    category           VARCHAR(60)  NOT NULL DEFAULT 'other',
    amount             NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    description        TEXT,
    payment_mode       VARCHAR(20)  NOT NULL DEFAULT 'cash'
                       CHECK (payment_mode IN ('cash', 'bank', 'upi', 'gst_cash')),

    bill_number        VARCHAR(100),
    bill_url           TEXT,
    photo_url          TEXT,
    photo_source       VARCHAR(20)  NOT NULL DEFAULT 'unknown'
                       CHECK (photo_source IN ('camera', 'gallery', 'unknown')),
    photo_captured_at  TIMESTAMPTZ,

    -- Cross-links so a supervisor expense can be traced to what it paid for.
    labour_id          BIGINT       REFERENCES public.labour (id) ON DELETE SET NULL,
    material_entry_id  BIGINT       REFERENCES public.site_material_entries (id) ON DELETE SET NULL,

    recorded_by        INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    access_request_id  BIGINT,

    approval_status    VARCHAR(20)  NOT NULL DEFAULT 'pending'
                       CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    admin_comment      TEXT,
    approved_by        INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    approved_at        TIMESTAMPTZ,

    is_deleted         BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMPTZ,
    deleted_by         INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sexp_supervisor_date
    ON public.supervisor_expenses (supervisor_user_id, expense_date DESC)
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_sexp_company_date
    ON public.supervisor_expenses (company_id, expense_date DESC)
    WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_sexp_approval
    ON public.supervisor_expenses (company_id, approval_status)
    WHERE is_deleted = FALSE;


-- ---------------------------------------------------------------------------
-- 4.7  entry_access_requests  (notebook pages 03 & 04)
--
-- "All of this must be added within 2 days. To add a bill older than 2 days
--  you have to call the company and get access."
--
-- A supervisor requests access for a specific past date; an admin grants it
-- with an expiry. The backend checks for a live grant before accepting a
-- backdated entry.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entry_access_requests (
    id             BIGSERIAL PRIMARY KEY,
    company_id     INTEGER      NOT NULL
                   REFERENCES public.companies (id) ON DELETE CASCADE,
    requested_by   INTEGER      NOT NULL
                   REFERENCES public.users (id) ON DELETE CASCADE,
    tender_id      INTEGER      REFERENCES public.tenders (id) ON DELETE SET NULL,
    site_id        INTEGER      REFERENCES public.sites (id)   ON DELETE SET NULL,

    -- material | labour | banking | daily_update | expense
    module         VARCHAR(40)  NOT NULL,
    -- The past date the requester needs to write to.
    target_date    DATE         NOT NULL,
    reason         TEXT         NOT NULL DEFAULT '',

    status         VARCHAR(20)  NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'granted', 'denied', 'expired', 'used')),
    admin_comment  TEXT,
    reviewed_by    INTEGER      REFERENCES public.users (id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    -- A grant is time-boxed; default 24h is applied by the API.
    expires_at     TIMESTAMPTZ,
    used_at        TIMESTAMPTZ,

    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ear_company_status
    ON public.entry_access_requests (company_id, status);
CREATE INDEX IF NOT EXISTS idx_ear_lookup
    ON public.entry_access_requests (requested_by, module, target_date, status);

-- Wire the deferred FKs now that the table exists.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('site_material_entries', 'sme_access_request_fkey'),
            ('labour_work_entries',   'lwe_access_request_fkey'),
            ('supervisor_expenses',   'sexp_access_request_fkey')
        ) AS v(tbl, con)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.con) THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD CONSTRAINT %I
                     FOREIGN KEY (access_request_id)
                     REFERENCES public.entry_access_requests (id) ON DELETE SET NULL',
                r.tbl, r.con
            );
        END IF;
    END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- 4.8  Auth hardening support — token revocation
--
-- Bumping token_version invalidates every JWT already issued to that user,
-- which is what makes "change password" and "deactivate user" actually take
-- effect before the 7-day expiry.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS token_version   INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_logins   INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until    TIMESTAMPTZ;


-- ===========================================================================
-- 5. updated_at triggers
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t   TEXT;
    tbl TEXT[] := ARRAY[
        'daily_update_approvals', 'tender_workers', 'material_catalog',
        'site_material_entries', 'labour', 'labour_work_entries',
        'supervisor_fund_receipts', 'supervisor_expenses',
        'entry_access_requests'
    ];
BEGIN
    FOREACH t IN ARRAY tbl LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
            t, t
        );
    END LOOP;
END $$;


COMMIT;

-- ===========================================================================
-- Verification — run after the migration
-- ===========================================================================
--
--   SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN ('daily_update_approvals','tender_workers',
--                        'material_catalog','site_material_entries','labour',
--                        'labour_work_entries','supervisor_fund_receipts',
--                        'supervisor_expenses','entry_access_requests')
--    ORDER BY 1;
--   -- expect 9 rows
--
--   SELECT table_name FROM information_schema.columns
--    WHERE table_schema='public' AND column_name='company_id'
--      AND table_name IN ('worker_allocations','worker_expenses',
--                         'worker_assignments','tender_documents')
--    ORDER BY 1;
--   -- expect 4 rows
-- ===========================================================================
