-- Speeds up "stores near me": the bounding box narrows the rows by latitude/longitude first
ALTER TABLE stores ADD INDEX idx_stores_lat_lng (latitude, longitude);