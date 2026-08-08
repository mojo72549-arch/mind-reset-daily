CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  role ENUM('tech','office','admin') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  phone VARCHAR(80),
  email VARCHAR(255),
  billing_address TEXT,
  service_address TEXT,
  preferred_channel ENUM('whatsapp','email','post') NOT NULL DEFAULT 'email',
  hourly_rate DECIMAL(10,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_catalog (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) UNIQUE,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_price_overrides (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  service_id BIGINT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  valid_from DATE NULL,
  valid_until DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_service (customer_id, service_id),
  CONSTRAINT fk_cpo_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_cpo_service FOREIGN KEY (service_id) REFERENCES service_catalog(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(80) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(120),
  scheduled_at DATETIME NULL,
  priority VARCHAR(40) DEFAULT 'Normal',
  status VARCHAR(60) NOT NULL DEFAULT 'Offen',
  assigned_user_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_order_user FOREIGN KEY (assigned_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE,
  status VARCHAR(60) NOT NULL DEFAULT 'Entwurf',
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  work_text TEXT,
  result_text TEXT,
  customer_signer_name VARCHAR(255),
  customer_signature MEDIUMTEXT,
  technician_signature MEDIUMTEXT,
  pdf_snapshot_url TEXT,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE report_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL,
  service_id BIGINT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(40) NOT NULL,
  unit_price_snapshot DECIMAL(10,2) NOT NULL,
  total_snapshot DECIMAL(12,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_reportline_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_reportline_service FOREIGN KEY (service_id) REFERENCES service_catalog(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE report_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(40),
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_reportmaterial_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE report_measurements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  value VARCHAR(120),
  unit VARCHAR(40),
  result VARCHAR(40),
  CONSTRAINT fk_reportmeasurement_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE report_photos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  caption VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reportphoto_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE number_sequences (
  sequence_key VARCHAR(80) PRIMARY KEY,
  current_value BIGINT NOT NULL,
  increment_by INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO number_sequences(sequence_key,current_value,increment_by)
VALUES ('invoice',26170,5)
ON DUPLICATE KEY UPDATE increment_by=5;

CREATE TABLE invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_no BIGINT NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  report_id BIGINT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('Entwurf','Offen','Versendet','Teilbezahlt','Bezahlt','Überfällig','Storniert') NOT NULL DEFAULT 'Offen',
  net_total DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 19.00,
  vat_total DECIMAL(12,2) NOT NULL,
  gross_total DECIMAL(12,2) NOT NULL,
  pdf_snapshot_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_invoice_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_invoice_report FOREIGN KEY (report_id) REFERENCES reports(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_invoiceline_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  from_status VARCHAR(60),
  to_status VARCHAR(60) NOT NULL,
  changed_by BIGINT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(500),
  CONSTRAINT fk_invoicehistory_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_invoicehistory_user FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE document_deliveries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  document_type ENUM('rapport','invoice') NOT NULL,
  document_id BIGINT NOT NULL,
  channel ENUM('whatsapp','email','post') NOT NULL,
  destination VARCHAR(255),
  status VARCHAR(60) NOT NULL DEFAULT 'Vorbereitet',
  sent_by BIGINT NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_delivery_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_delivery_user FOREIGN KEY (sent_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_intervals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  interval_months INT NULL,
  next_due_date DATE NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_interval_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT NULL,
  action VARCHAR(120) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
