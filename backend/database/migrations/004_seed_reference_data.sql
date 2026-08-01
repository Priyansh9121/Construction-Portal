-- ===========================================================================
-- Construction Portal — Migration 004: Reference / seed data
-- ===========================================================================
--
-- Seeds the pick-lists the supervisor screens need:
--   * material_catalog — the "Main Section" material list from notebook p.02
--   * labour categories — the work types from notebook p.05
--
-- Safe to re-run: everything is ON CONFLICT DO NOTHING.
--
-- HOW TO RUN
--   psql "$DATABASE_URL" -f 004_seed_reference_data.sql
--   Supabase: SQL Editor → paste → Run
--
-- By default this seeds EVERY existing company. To seed one company only,
-- call the function directly:
--     SELECT public.seed_material_catalog(3);
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Material catalog seeder
-- ---------------------------------------------------------------------------
-- Materials transcribed from the operations notebook (p.02, "Main Section"),
-- with Gujarati names preserved in name_local so supervisors see familiar
-- labels on the site screens.
CREATE OR REPLACE FUNCTION public.seed_material_catalog(p_company_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    inserted INTEGER := 0;
BEGIN
    INSERT INTO public.material_catalog
        (company_id, name, name_local, main_section, unit, default_gst_percent, sort_order)
    VALUES
        -- ---- Aggregates & sand -------------------------------------------
        (p_company_id, 'Aggregate (Kapchi)', 'કપચી',        'aggregate', 'cft',   5,  10),
        (p_company_id, 'Grit / Metal',       'ગ્રીટ',        'aggregate', 'cft',   5,  20),
        (p_company_id, 'Sand',               'રેતી',         'aggregate', 'cft',   5,  30),
        (p_company_id, 'Black Trap Metal',   'બ્લેક ટ્રેપ',   'aggregate', 'cft',   5,  40),

        -- ---- Binders ------------------------------------------------------
        (p_company_id, 'Cement (OPC 53)',    'સિમેન્ટ',      'binder',    'bag',  28,  50),
        (p_company_id, 'Cement (PPC)',       'સિમેન્ટ PPC',  'binder',    'bag',  28,  60),
        (p_company_id, 'Lime',               'ચૂનો',         'binder',    'bag',   5,  70),

        -- ---- Bitumen / road ----------------------------------------------
        (p_company_id, 'Bitumen',            'ડામર',         'road',      'kg',   18,  80),
        (p_company_id, 'Emulsion',           'ઇમલ્શન',       'road',      'ltr',  18,  90),
        (p_company_id, 'Kota Stone',         'કોટા સ્ટોન',    'road',      'sqft', 18, 100),

        -- ---- Steel --------------------------------------------------------
        (p_company_id, 'Steel / TMT Bar',    'લોખંડ',        'steel',     'kg',   18, 110),
        (p_company_id, 'Binding Wire',       'બાંધણી તાર',   'steel',     'kg',   18, 120),
        (p_company_id, 'MS Angle',           'એમએસ એંગલ',   'steel',     'kg',   18, 130),

        -- ---- Masonry ------------------------------------------------------
        (p_company_id, 'Brick',              'ઈંટ',          'masonry',   'nos',   5, 140),
        (p_company_id, 'Block (AAC)',        'બ્લોક',        'masonry',   'nos',  12, 150),
        (p_company_id, 'Fly Ash Brick',      'ફ્લાય એશ ઈંટ', 'masonry',   'nos',   5, 160),

        -- ---- Finishes -----------------------------------------------------
        (p_company_id, 'Tiles',              'ટાઇલ્સ',       'finish',    'sqft', 18, 170),
        (p_company_id, 'Marble',             'માર્બલ',       'finish',    'sqft', 18, 180),
        (p_company_id, 'Paint',              'રંગ',          'finish',    'ltr',  18, 190),
        (p_company_id, 'Putty',              'પુટ્ટી',        'finish',    'bag',  18, 200),

        -- ---- Services -----------------------------------------------------
        (p_company_id, 'Water',              'પાણી',         'service',   'tanker', 0, 210),
        (p_company_id, 'Electrical Fitting', 'ઇલેક્ટ્રિક',    'service',   'unit', 18, 220),
        (p_company_id, 'Plumbing Fitting',   'પ્લમ્બિંગ',     'service',   'unit', 18, 230),

        -- ---- Catch-all ----------------------------------------------------
        (p_company_id, 'Other',              'અન્ય',         'other',     'unit',  0, 999)
    ON CONFLICT (company_id, lower(name)) DO NOTHING;

    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$;

COMMENT ON FUNCTION public.seed_material_catalog(INTEGER) IS
    'Seeds the standard construction material catalog for one company. Idempotent.';


-- ---------------------------------------------------------------------------
-- 2. Labour categories
-- ---------------------------------------------------------------------------
-- Notebook p.05 names કડિયા (mason), પ્લાસ્ટર (plasterer) and છત કામ
-- (roofing) explicitly; the rest are the usual trades on an Indian site.
--
-- These live in a small lookup so the supervisor's "category" dropdown is
-- data, not hardcoded JSX — matching how the rest of this codebase treats
-- UI configuration.
CREATE TABLE IF NOT EXISTS public.labour_categories (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER      NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
    code        VARCHAR(40)  NOT NULL,
    name        VARCHAR(80)  NOT NULL,
    name_local  VARCHAR(80),
    default_rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_labour_categories_company_code
    ON public.labour_categories (company_id, code);

CREATE OR REPLACE FUNCTION public.seed_labour_categories(p_company_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    inserted INTEGER := 0;
BEGIN
    INSERT INTO public.labour_categories
        (company_id, code, name, name_local, sort_order)
    VALUES
        (p_company_id, 'kadiya',     'Mason',            'કડિયા',        10),
        (p_company_id, 'plaster',    'Plasterer',        'પ્લાસ્ટર',      20),
        (p_company_id, 'chhat',      'Roofing / Slab',   'છત કામ',       30),
        (p_company_id, 'centering',  'Centering',        'સેન્ટરિંગ',     40),
        (p_company_id, 'bar_bender', 'Bar Bender',       'સળિયા વાળનાર', 50),
        (p_company_id, 'helper',     'Helper / Majur',   'મજૂર',         60),
        (p_company_id, 'painter',    'Painter',          'રંગારો',       70),
        (p_company_id, 'tiles',      'Tile Fitter',      'ટાઇલ્સ કારીગર', 80),
        (p_company_id, 'electrician','Electrician',      'ઇલેક્ટ્રિશિયન',  90),
        (p_company_id, 'plumber',    'Plumber',          'પ્લમ્બર',      100),
        (p_company_id, 'welder',     'Welder',           'વેલ્ડર',       110),
        (p_company_id, 'driver',     'Driver / Operator','ડ્રાઇવર',      120),
        (p_company_id, 'other',      'Other',            'અન્ય',         999)
    ON CONFLICT (company_id, code) DO NOTHING;

    GET DIAGNOSTICS inserted = ROW_COUNT;
    RETURN inserted;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Apply to every existing company
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    c        RECORD;
    m_total  INTEGER := 0;
    l_total  INTEGER := 0;
    m        INTEGER;
    l        INTEGER;
BEGIN
    FOR c IN SELECT id, company_name FROM public.companies ORDER BY id LOOP
        SELECT public.seed_material_catalog(c.id)  INTO m;
        SELECT public.seed_labour_categories(c.id) INTO l;

        m_total := m_total + m;
        l_total := l_total + l;

        RAISE NOTICE 'Company % (%): % materials, % labour categories added.',
            c.id, c.company_name, m, l;
    END LOOP;

    RAISE NOTICE 'Seed complete — % material rows, % labour category rows.',
        m_total, l_total;
END $$;


-- ---------------------------------------------------------------------------
-- 4. Auto-seed future companies
-- ---------------------------------------------------------------------------
-- A newly registered company gets the standard catalog immediately, so the
-- supervisor screens are never empty on day one.
CREATE OR REPLACE FUNCTION public.seed_new_company_reference_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.seed_material_catalog(NEW.id);
    PERFORM public.seed_labour_categories(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_company_reference_data ON public.companies;
CREATE TRIGGER trg_seed_company_reference_data
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.seed_new_company_reference_data();


-- ---------------------------------------------------------------------------
-- 5. RLS for labour_categories
-- ---------------------------------------------------------------------------
-- This table is created here rather than in 001, so it misses the catalog
-- sweep in 003. Protect it explicitly, otherwise it would be the one
-- tenant-owned table without a policy.
--
-- Guarded so this file still runs on a database where 003 has not been
-- applied (e.g. a local setup that has not adopted RLS yet).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'current_company_id'
    ) THEN
        ALTER TABLE public.labour_categories ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.labour_categories FORCE  ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON public.labour_categories;
        CREATE POLICY tenant_isolation ON public.labour_categories
            FOR ALL
            USING      (company_id = public.current_company_id())
            WITH CHECK (company_id = public.current_company_id());

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'construction_app') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE
                ON public.labour_categories TO construction_app;
            GRANT USAGE, SELECT
                ON SEQUENCE public.labour_categories_id_seq TO construction_app;
        END IF;

        RAISE NOTICE 'RLS enabled on labour_categories.';
    ELSE
        RAISE NOTICE 'Skipping RLS on labour_categories — run 003_supabase_rls.sql first, then re-run this file.';
    END IF;
END $$;


COMMIT;

-- ===========================================================================
-- Verify
--   SELECT main_section, count(*) FROM material_catalog GROUP BY 1 ORDER BY 1;
--   SELECT code, name, name_local FROM labour_categories ORDER BY sort_order;
-- ===========================================================================
