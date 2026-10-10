ALTER TABLE stores
  ADD COLUMN category ENUM('RESTAURANT','CAFE','GROCERY','ELECTRONICS','CLOTHING','SALON','FITNESS','PHARMACY','BOOKSTORE','OTHER')
      NOT NULL DEFAULT 'OTHER' AFTER address,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN phone VARCHAR(20) NULL,
  ADD COLUMN city VARCHAR(100) NULL,
  ADD COLUMN state VARCHAR(100) NULL,
  ADD COLUMN pincode VARCHAR(10) NULL,
  ADD COLUMN website VARCHAR(255) NULL,
  ADD COLUMN image_url VARCHAR(500) NULL,
  ADD COLUMN latitude DECIMAL(9,6) NULL,
  ADD COLUMN longitude DECIMAL(9,6) NULL,
  ADD COLUMN opening_time TIME NULL,
  ADD COLUMN closing_time TIME NULL,
  ADD COLUMN status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE stores
  ADD CONSTRAINT chk_stores_lat CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT chk_stores_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT chk_stores_coords_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT chk_stores_hours_pair CHECK ((opening_time IS NULL) = (closing_time IS NULL)),
  ADD INDEX idx_stores_category (category),
  ADD INDEX idx_stores_city (city),
  ADD INDEX idx_stores_status (status);