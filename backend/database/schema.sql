CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL,
  owner_user_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_users (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'manager'
);

CREATE TABLE payments (
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

CREATE TABLE workers (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  full_name VARCHAR(100),
  phone VARCHAR(30),
  salary DECIMAL(12,2),
  role VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  site_type VARCHAR(50),
  site_name VARCHAR(150),
  address TEXT,
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE tenders (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  site_id INT REFERENCES sites(id) ON DELETE CASCADE,
  title VARCHAR(150),
  status VARCHAR(50),
  due_date DATE,
  description TEXT
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100),
  amount DECIMAL(12,2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_site_logs (
  id SERIAL PRIMARY KEY,
  site_id INT REFERENCES sites(id) ON DELETE CASCADE,
  worker_id INT REFERENCES workers(id) ON DELETE SET NULL,
  log_date DATE,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE worker_allocations (
  id SERIAL PRIMARY KEY,
  worker_id INT REFERENCES workers(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(12,2),
  purpose TEXT,
  allocated_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE worker_expenses (
  id SERIAL PRIMARY KEY,
  allocation_id INT REFERENCES worker_allocations(id) ON DELETE CASCADE,
  expense_amount DECIMAL(12,2),
  expense_description TEXT,
  expense_date DATE,
  remaining_balance DECIMAL(12,2),
  uploaded_photo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tender_documents (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  document_name VARCHAR(150),
  document_type VARCHAR(50),
  file_url TEXT,
  uploaded_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tender_materials (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  section_name VARCHAR(100),
  material_name VARCHAR(100),
  quantity DECIMAL(12,2),
  unit VARCHAR(50),
  rate DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tender_banking (
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


CREATE TABLE subcontractors (
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

CREATE TABLE tender_subcontractors (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  subcontractor_id INT REFERENCES subcontractors(id) ON DELETE CASCADE,
  work_description TEXT,
  assigned_amount DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tender_documents (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  document_name VARCHAR(150),
  document_type VARCHAR(50),
  file_url TEXT,
  uploaded_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tender_materials (
  id SERIAL PRIMARY KEY,
  tender_id INT REFERENCES tenders(id) ON DELETE CASCADE,
  section_name VARCHAR(100),
  material_name VARCHAR(100),
  quantity DECIMAL(12,2),
  unit VARCHAR(50),
  rate DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tender_banking (
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