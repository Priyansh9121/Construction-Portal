--
-- PostgreSQL database dump
--

\restrict cZLhinrYSlg1x3Xy9rIWptaVZn0wsa9eDaAQrRqTgKSwDEx2ibpp4UABpDufL7v

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    company_name character varying(150) NOT NULL,
    owner_user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: company_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_users (
    id integer NOT NULL,
    company_id integer,
    user_id integer,
    role character varying(50) DEFAULT 'manager'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_users_id_seq OWNED BY public.company_users.id;


--
-- Name: daily_site_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_site_logs (
    id integer NOT NULL,
    site_id integer,
    worker_id integer,
    log_date date,
    notes text,
    photo_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tender_id integer,
    created_by integer,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    approval_status character varying(30) DEFAULT 'approved'::character varying,
    admin_comment text,
    approved_by integer,
    approved_at timestamp with time zone,
    reason text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_site_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_site_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_site_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_site_logs_id_seq OWNED BY public.daily_site_logs.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    company_id integer,
    tender_id integer,
    invoice_number character varying(100),
    amount numeric(12,2),
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    company_id integer,
    payment_type character varying(50),
    category character varying(100),
    amount numeric(12,2),
    description text,
    payment_date date,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    updated_at timestamp with time zone DEFAULT now(),
    payment_scope character varying(80),
    payment_sub_type character varying(80),
    details text,
    tender_id bigint,
    site_id bigint,
    worker_name character varying(150),
    investor_name character varying(150),
    material_name character varying(200),
    quantity numeric(14,3) DEFAULT 0,
    gst_amount numeric(14,2) DEFAULT 0,
    collected_gst numeric(14,2) DEFAULT 0,
    gst_percent numeric(8,3) DEFAULT 0,
    gst_total numeric(14,2) DEFAULT 0,
    gst_done numeric(14,2) DEFAULT 0,
    company_charge_percent numeric(8,3) DEFAULT 0,
    company_charge_total numeric(14,2) DEFAULT 0,
    tds_amount numeric(14,2) DEFAULT 0,
    payment_mode character varying(50),
    interest_percent numeric(8,3) DEFAULT 0,
    fd_site character varying(200)
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id integer NOT NULL,
    company_id integer,
    site_type character varying(50),
    site_name character varying(150),
    address text,
    status character varying(50) DEFAULT 'active'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sites_id_seq OWNED BY public.sites.id;


--
-- Name: subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontractors (
    id integer NOT NULL,
    company_id integer,
    full_name character varying(150) NOT NULL,
    phone character varying(30),
    email character varying(150),
    business_name character varying(150),
    gst_number character varying(100),
    bank_name character varying(150),
    account_name character varying(150),
    account_number character varying(100),
    ifsc_code character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    user_id integer
);


--
-- Name: subcontractors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subcontractors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subcontractors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subcontractors_id_seq OWNED BY public.subcontractors.id;


--
-- Name: tender_banking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tender_banking (
    id integer NOT NULL,
    tender_id integer,
    payment_type character varying(100),
    bank_name character varying(150),
    account_name character varying(150),
    account_number character varying(100),
    amount numeric(12,2),
    gst_amount numeric(12,2),
    notes text,
    payment_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer
);


--
-- Name: tender_banking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tender_banking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tender_banking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tender_banking_id_seq OWNED BY public.tender_banking.id;


--
-- Name: tender_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tender_documents (
    id integer NOT NULL,
    tender_id integer,
    document_name character varying(150),
    document_type character varying(50),
    file_url text,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer
);


--
-- Name: tender_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tender_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tender_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tender_documents_id_seq OWNED BY public.tender_documents.id;


--
-- Name: tender_finance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tender_finance_records (
    id integer NOT NULL,
    tender_id integer,
    site_id integer,
    record_type character varying(50) NOT NULL,
    source_name character varying(255),
    payment_mode character varying(20),
    amount numeric(12,2) DEFAULT 0,
    interest_percent numeric(5,2) DEFAULT 0,
    gst_percent numeric(5,2) DEFAULT 18,
    gst_total numeric(12,2) DEFAULT 0,
    gst_done numeric(12,2) DEFAULT 0,
    gst_left numeric(12,2) DEFAULT 0,
    company_charge_percent numeric(5,2) DEFAULT 2,
    company_charge_total numeric(12,2) DEFAULT 0,
    company_charge_done numeric(12,2) DEFAULT 0,
    company_charge_left numeric(12,2) DEFAULT 0,
    tds_amount numeric(12,2) DEFAULT 0,
    record_date date,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false
);


--
-- Name: tender_finance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tender_finance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tender_finance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tender_finance_records_id_seq OWNED BY public.tender_finance_records.id;


--
-- Name: tender_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tender_materials (
    id integer NOT NULL,
    tender_id integer,
    section_name character varying(100),
    material_name character varying(100),
    quantity numeric(12,2),
    unit character varying(50),
    rate numeric(12,2),
    total_amount numeric(12,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    vendor_name character varying(255)
);


--
-- Name: tender_materials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tender_materials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tender_materials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tender_materials_id_seq OWNED BY public.tender_materials.id;


--
-- Name: tender_subcontractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tender_subcontractors (
    id integer NOT NULL,
    tender_id integer,
    subcontractor_id integer,
    work_description text,
    assigned_amount numeric(12,2),
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer
);


--
-- Name: tender_subcontractors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tender_subcontractors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tender_subcontractors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tender_subcontractors_id_seq OWNED BY public.tender_subcontractors.id;


--
-- Name: tenders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenders (
    id integer NOT NULL,
    company_id integer,
    site_id integer,
    title character varying(150),
    status character varying(50),
    due_date date,
    description text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    estimated_value numeric(14,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenders_id_seq OWNED BY public.tenders.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(50) DEFAULT 'active'::character varying,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: worker_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_allocations (
    id integer NOT NULL,
    worker_id integer,
    allocated_amount numeric(12,2),
    purpose text,
    allocated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_status character varying(30) DEFAULT 'approved'::character varying,
    admin_comment text,
    approved_by integer,
    approved_at timestamp with time zone,
    created_by integer,
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by integer
);


--
-- Name: worker_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_allocations_id_seq OWNED BY public.worker_allocations.id;


--
-- Name: worker_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_assignments (
    id integer NOT NULL,
    worker_id integer NOT NULL,
    site_id integer NOT NULL,
    tender_id integer,
    assigned_by integer,
    notes text,
    status character varying(50) DEFAULT 'active'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone
);


--
-- Name: worker_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_assignments_id_seq OWNED BY public.worker_assignments.id;


--
-- Name: worker_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_expenses (
    id integer NOT NULL,
    allocation_id integer,
    expense_amount numeric(12,2),
    expense_description text,
    expense_date date,
    remaining_balance numeric(12,2),
    uploaded_photo text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_status character varying(30) DEFAULT 'approved'::character varying,
    admin_comment text,
    approved_by integer,
    approved_at timestamp with time zone,
    created_by integer,
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by integer
);


--
-- Name: worker_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.worker_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: worker_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.worker_expenses_id_seq OWNED BY public.worker_expenses.id;


--
-- Name: workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workers (
    id integer NOT NULL,
    company_id integer,
    full_name character varying(100),
    phone character varying(30),
    salary numeric(12,2),
    role character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    user_id integer,
    email character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workers_id_seq OWNED BY public.workers.id;


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: company_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_users ALTER COLUMN id SET DEFAULT nextval('public.company_users_id_seq'::regclass);


--
-- Name: daily_site_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs ALTER COLUMN id SET DEFAULT nextval('public.daily_site_logs_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: sites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites ALTER COLUMN id SET DEFAULT nextval('public.sites_id_seq'::regclass);


--
-- Name: subcontractors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors ALTER COLUMN id SET DEFAULT nextval('public.subcontractors_id_seq'::regclass);


--
-- Name: tender_banking id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_banking ALTER COLUMN id SET DEFAULT nextval('public.tender_banking_id_seq'::regclass);


--
-- Name: tender_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_documents ALTER COLUMN id SET DEFAULT nextval('public.tender_documents_id_seq'::regclass);


--
-- Name: tender_finance_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_finance_records ALTER COLUMN id SET DEFAULT nextval('public.tender_finance_records_id_seq'::regclass);


--
-- Name: tender_materials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_materials ALTER COLUMN id SET DEFAULT nextval('public.tender_materials_id_seq'::regclass);


--
-- Name: tender_subcontractors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_subcontractors ALTER COLUMN id SET DEFAULT nextval('public.tender_subcontractors_id_seq'::regclass);


--
-- Name: tenders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenders ALTER COLUMN id SET DEFAULT nextval('public.tenders_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: worker_allocations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_allocations ALTER COLUMN id SET DEFAULT nextval('public.worker_allocations_id_seq'::regclass);


--
-- Name: worker_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments ALTER COLUMN id SET DEFAULT nextval('public.worker_assignments_id_seq'::regclass);


--
-- Name: worker_expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_expenses ALTER COLUMN id SET DEFAULT nextval('public.worker_expenses_id_seq'::regclass);


--
-- Name: workers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers ALTER COLUMN id SET DEFAULT nextval('public.workers_id_seq'::regclass);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_users company_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_users
    ADD CONSTRAINT company_users_pkey PRIMARY KEY (id);


--
-- Name: daily_site_logs daily_site_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs
    ADD CONSTRAINT daily_site_logs_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: subcontractors subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_pkey PRIMARY KEY (id);


--
-- Name: tender_banking tender_banking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_banking
    ADD CONSTRAINT tender_banking_pkey PRIMARY KEY (id);


--
-- Name: tender_documents tender_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_documents
    ADD CONSTRAINT tender_documents_pkey PRIMARY KEY (id);


--
-- Name: tender_finance_records tender_finance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_finance_records
    ADD CONSTRAINT tender_finance_records_pkey PRIMARY KEY (id);


--
-- Name: tender_materials tender_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_materials
    ADD CONSTRAINT tender_materials_pkey PRIMARY KEY (id);


--
-- Name: tender_subcontractors tender_subcontractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_subcontractors
    ADD CONSTRAINT tender_subcontractors_pkey PRIMARY KEY (id);


--
-- Name: tenders tenders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: worker_allocations worker_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_allocations
    ADD CONSTRAINT worker_allocations_pkey PRIMARY KEY (id);


--
-- Name: worker_assignments worker_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments
    ADD CONSTRAINT worker_assignments_pkey PRIMARY KEY (id);


--
-- Name: worker_expenses worker_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_expenses
    ADD CONSTRAINT worker_expenses_pkey PRIMARY KEY (id);


--
-- Name: workers workers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_pkey PRIMARY KEY (id);


--
-- Name: idx_daily_site_logs_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_site_logs_approval_status ON public.daily_site_logs USING btree (approval_status);


--
-- Name: idx_daily_site_logs_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_site_logs_is_deleted ON public.daily_site_logs USING btree (is_deleted);


--
-- Name: idx_daily_site_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_site_logs_status ON public.daily_site_logs USING btree (approval_status) WHERE (is_deleted = false);


--
-- Name: idx_daily_site_logs_tender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_site_logs_tender ON public.daily_site_logs USING btree (tender_id, log_date DESC) WHERE (is_deleted = false);


--
-- Name: idx_daily_site_logs_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_site_logs_worker ON public.daily_site_logs USING btree (worker_id, log_date DESC) WHERE (is_deleted = false);


--
-- Name: idx_payments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_active ON public.payments USING btree (is_deleted, payment_date);


--
-- Name: idx_payments_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_is_deleted ON public.payments USING btree (is_deleted);


--
-- Name: idx_payments_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_site ON public.payments USING btree (site_id) WHERE (is_deleted = false);


--
-- Name: idx_payments_tender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_tender ON public.payments USING btree (tender_id) WHERE (is_deleted = false);


--
-- Name: idx_tenders_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_site ON public.tenders USING btree (site_id) WHERE (is_deleted = false);


--
-- Name: idx_worker_allocations_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_allocations_is_deleted ON public.worker_allocations USING btree (is_deleted);


--
-- Name: idx_worker_allocations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_allocations_status ON public.worker_allocations USING btree (approval_status) WHERE (is_deleted = false);


--
-- Name: idx_worker_allocations_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_allocations_worker ON public.worker_allocations USING btree (worker_id) WHERE (is_deleted = false);


--
-- Name: idx_worker_assignments_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_assignments_site_id ON public.worker_assignments USING btree (site_id);


--
-- Name: idx_worker_assignments_tender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_assignments_tender ON public.worker_assignments USING btree (tender_id) WHERE (is_deleted = false);


--
-- Name: idx_worker_assignments_tender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_assignments_tender_id ON public.worker_assignments USING btree (tender_id);


--
-- Name: idx_worker_assignments_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_assignments_worker ON public.worker_assignments USING btree (worker_id) WHERE (is_deleted = false);


--
-- Name: idx_worker_assignments_worker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_assignments_worker_id ON public.worker_assignments USING btree (worker_id);


--
-- Name: idx_worker_expenses_allocation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_expenses_allocation ON public.worker_expenses USING btree (allocation_id) WHERE (is_deleted = false);


--
-- Name: idx_worker_expenses_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_expenses_approval_status ON public.worker_expenses USING btree (approval_status);


--
-- Name: idx_worker_expenses_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_expenses_is_deleted ON public.worker_expenses USING btree (is_deleted);


--
-- Name: idx_worker_expenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_expenses_status ON public.worker_expenses USING btree (approval_status) WHERE (is_deleted = false);


--
-- Name: ux_company_users_company_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_company_users_company_user ON public.company_users USING btree (company_id, user_id);


--
-- Name: ux_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- Name: ux_worker_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_worker_assignments_active ON public.worker_assignments USING btree (worker_id, site_id, tender_id) WHERE (is_deleted = false);


--
-- Name: ux_workers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_workers_user_id ON public.workers USING btree (user_id) WHERE ((user_id IS NOT NULL) AND (is_deleted = false));


--
-- Name: companies companies_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: company_users company_users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_users
    ADD CONSTRAINT company_users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_users company_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_users
    ADD CONSTRAINT company_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_site_logs daily_site_logs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs
    ADD CONSTRAINT daily_site_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: daily_site_logs daily_site_logs_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs
    ADD CONSTRAINT daily_site_logs_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: daily_site_logs daily_site_logs_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs
    ADD CONSTRAINT daily_site_logs_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: daily_site_logs daily_site_logs_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs
    ADD CONSTRAINT daily_site_logs_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id);


--
-- Name: daily_site_logs daily_site_logs_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_site_logs
    ADD CONSTRAINT daily_site_logs_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;


--
-- Name: payments payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sites sites_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: subcontractors subcontractors_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: subcontractors subcontractors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontractors
    ADD CONSTRAINT subcontractors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tender_banking tender_banking_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_banking
    ADD CONSTRAINT tender_banking_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;


--
-- Name: tender_documents tender_documents_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_documents
    ADD CONSTRAINT tender_documents_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;


--
-- Name: tender_documents tender_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_documents
    ADD CONSTRAINT tender_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: tender_finance_records tender_finance_records_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_finance_records
    ADD CONSTRAINT tender_finance_records_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: tender_finance_records tender_finance_records_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_finance_records
    ADD CONSTRAINT tender_finance_records_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;


--
-- Name: tender_materials tender_materials_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_materials
    ADD CONSTRAINT tender_materials_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;


--
-- Name: tender_subcontractors tender_subcontractors_subcontractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_subcontractors
    ADD CONSTRAINT tender_subcontractors_subcontractor_id_fkey FOREIGN KEY (subcontractor_id) REFERENCES public.subcontractors(id) ON DELETE CASCADE;


--
-- Name: tender_subcontractors tender_subcontractors_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tender_subcontractors
    ADD CONSTRAINT tender_subcontractors_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE CASCADE;


--
-- Name: tenders tenders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: tenders tenders_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: worker_allocations worker_allocations_allocated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_allocations
    ADD CONSTRAINT worker_allocations_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES public.users(id);


--
-- Name: worker_allocations worker_allocations_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_allocations
    ADD CONSTRAINT worker_allocations_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;


--
-- Name: worker_assignments worker_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments
    ADD CONSTRAINT worker_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: worker_assignments worker_assignments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments
    ADD CONSTRAINT worker_assignments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: worker_assignments worker_assignments_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments
    ADD CONSTRAINT worker_assignments_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;


--
-- Name: worker_assignments worker_assignments_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments
    ADD CONSTRAINT worker_assignments_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tenders(id) ON DELETE SET NULL;


--
-- Name: worker_assignments worker_assignments_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_assignments
    ADD CONSTRAINT worker_assignments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;


--
-- Name: worker_expenses worker_expenses_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_expenses
    ADD CONSTRAINT worker_expenses_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.worker_allocations(id) ON DELETE CASCADE;


--
-- Name: workers workers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: workers workers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workers
    ADD CONSTRAINT workers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tender_finance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tender_finance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict cZLhinrYSlg1x3Xy9rIWptaVZn0wsa9eDaAQrRqTgKSwDEx2ibpp4UABpDufL7v

