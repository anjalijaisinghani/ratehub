-- The database itself now guarantees: one owner, one store.
-- (The service already checks this, but two simultaneous requests could slip past a code check.)
ALTER TABLE stores ADD CONSTRAINT uq_stores_owner UNIQUE (owner_id);