CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  owner_user_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_users (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'manager'
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  payment_type VARCHAR(50),
  category VARCHAR(100),
  amount DECIMAL(12,2),
  description TEXT,
  payment_date DATE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workers (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  full_name VARCHAR(100),
  phone VARCHAR(30),
  salary DECIMAL(12,2),
  role VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  site_type VARCHAR(50),
  site_name VARCHAR(150),
  address TEXT,
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS tenders (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  site_id INT REFERENCES sites(id) ON DELETE CASCADE,
  title VARCHAR(150),
  status VARCHAR(50),
  estimated_value NUMERIC(14,2) DEFAULT 0
  due_date DATE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100),
  amount DECIMAL(12,2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_site_logs (
  id SERIAL PRIMARY KEY,
  site_id INT REFERENCES sites(id) ON DELETE CASCADE,
  worker_id INT REFERENCES workers(id) ON DELETE SET NULL,
  log_date DATE,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_allocations (
  id SERIAL PRIMARY KEY,
  worker_id INT REFERENCES workers(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(12,2),
  purpose TEXT,
  allocated_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worker_expenses (
  id SERIAL PRIMARY KEY,
  allocation_id INT REFERENCES worker_allocations(id) ON DELETE CASCADE,
  expense_amount DECIMAL(12,2),
  expense_description TEXT,
  expense_date DATE,
  remaining_balance DECIMAL(12,2),
  uploaded_photo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subcontractors (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(150),
  business_name VARCHAR(150),
  gst_number VARCHAR(100),
  bank_name VARCHAR(150),
  account_name VARCHAR(150),
  account_number VARCHAR(100),
  ifsc_code VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tender_subcontractors (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  subcontractor_id INT REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_description TEXT,
  assigned_amount DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tender_documents (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  document_name VARCHAR(150),
  document_type VARCHAR(50),
  file_url TEXT,
  uploaded_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tender_materials (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  section_name VARCHAR(100),
  material_name VARCHAR(100),
  quantity DECIMAL(12,2),
  unit VARCHAR(50),
  rate DECIMAL(12,2),
  vendor_name VARCHAR(255)
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tender_banking (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  payment_type VARCHAR(100),
  bank_name VARCHAR(150),
  account_name VARCHAR(150),
  account_number VARCHAR(100),
  amount DECIMAL(12,2),
  gst_amount DECIMAL(12,2),
  notes TEXT,
  payment_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

  