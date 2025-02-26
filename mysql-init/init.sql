CREATE TABLE apartments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  rooms INT,
  size VARCHAR(50),
  tenants VARCHAR(255),
  tenantEmail VARCHAR(100),
  tenantPhone VARCHAR(50),
  landlordName VARCHAR(255),
  landlordEmail VARCHAR(100),
  landlordPhone VARCHAR(50),
  moveInDate DATE,
  contractEndDate DATE,
  rent DECIMAL(10,2),
  deposit DECIMAL(10,2),
  notes TEXT,
  IBAN VARCHAR(50),
  status VARCHAR(50),
  management_fee DECIMAL(5,2) DEFAULT 0,  -- NEW COLUMN
  rent_cost DECIMAL(10,2) DEFAULT 0       -- NEW COLUMN
);

