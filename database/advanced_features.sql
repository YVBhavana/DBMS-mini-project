/*
  WarrantIQ - PostgreSQL advanced DBMS demonstration
  Run this script AFTER the application's base schema has been created.
  It uses the existing service_records(service_id, service_status) table.
  Re-runnable: creates its own audit objects/indexes idempotently.
*/

-- 1) DDL + constraints: normalized audit table with PK, FK, CHECK and self-FK.
CREATE TABLE IF NOT EXISTS service_status_audit (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES service_records(service_id) ON DELETE CASCADE,
    previous_audit_id BIGINT NULL REFERENCES service_status_audit(audit_id) ON DELETE SET NULL,
    old_status VARCHAR(40),
    new_status VARCHAR(40) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_audit_new_status CHECK (length(trim(new_status)) > 0),
    CONSTRAINT chk_audit_status_change CHECK (old_status IS DISTINCT FROM new_status)
);

CREATE INDEX IF NOT EXISTS idx_service_status_audit_service_time
    ON service_status_audit(service_id, changed_at DESC);

-- 2) Trigger function: automatically record status changes made by the app or SQL.
CREATE OR REPLACE FUNCTION log_service_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    prior_audit_id BIGINT;
BEGIN
    IF NEW.service_status IS DISTINCT FROM OLD.service_status THEN
        SELECT audit_id INTO prior_audit_id
        FROM service_status_audit
        WHERE service_id = NEW.service_id
        ORDER BY audit_id DESC
        LIMIT 1;

        INSERT INTO service_status_audit
            (service_id, previous_audit_id, old_status, new_status)
        VALUES
            (NEW.service_id, prior_audit_id, OLD.service_status, NEW.service_status);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_status_audit ON service_records;
CREATE TRIGGER trg_service_status_audit
AFTER UPDATE OF service_status ON service_records
FOR EACH ROW
EXECUTE FUNCTION log_service_status_change();

-- 3) Stored procedure: controlled status update; trigger writes the audit row.
CREATE OR REPLACE PROCEDURE update_service_status(
    p_service_id INTEGER,
    p_new_status VARCHAR(40)
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_new_status IS NULL OR p_new_status NOT IN ('open', 'in_progress', 'resolved') THEN
        RAISE EXCEPTION 'Invalid service status: %', p_new_status;
    END IF;

    UPDATE service_records
    SET service_status = p_new_status
    WHERE service_id = p_service_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service request % does not exist', p_service_id;
    END IF;
END;
$$;

-- 4) SQL function: fetch one service request and its current status.
CREATE OR REPLACE FUNCTION get_service_status(p_service_id INTEGER)
RETURNS TABLE(service_id INTEGER, service_status TEXT)
LANGUAGE SQL
STABLE
AS $$
    SELECT sr.service_id, sr.service_status::TEXT
    FROM service_records AS sr
    WHERE sr.service_id = p_service_id;
$$;

-- 5) JOIN + nested query: service requests with product and customer details,
--    limited to requests whose product has at least one active warranty.
SELECT
    sr.service_id,
    p.product_name,
    pi.serial_number,
    customer_user.full_name AS customer_name,
    sr.service_status
FROM service_records sr
JOIN purchase_items pi ON pi.purchase_item_id = sr.purchase_item_id
JOIN products p ON p.product_id = pi.product_id
JOIN purchases pu ON pu.purchase_id = pi.purchase_id
JOIN customers c ON c.customer_id = pu.customer_id
JOIN app_users customer_user ON customer_user.user_id = c.user_id
WHERE EXISTS (
    SELECT 1
    FROM warranties w
    WHERE w.purchase_item_id = pi.purchase_item_id
      AND w.warranty_status = 'active'
);

-- 6) Correlated subquery: service requests with the number of prior requests
--    from the same customer.
SELECT
    sr.service_id,
    customer_user.full_name AS customer_name,
    (SELECT COUNT(*)
     FROM service_records sr2
     JOIN purchase_items pi2 ON pi2.purchase_item_id = sr2.purchase_item_id
     JOIN purchases pu2 ON pu2.purchase_id = pi2.purchase_id
     WHERE pu2.customer_id = pu.customer_id
       AND sr2.reported_date <= sr.reported_date) AS customer_request_count,
    sr.service_status
FROM service_records sr
JOIN purchase_items pi ON pi.purchase_item_id = sr.purchase_item_id
JOIN purchases pu ON pu.purchase_id = pi.purchase_id
JOIN customers c ON c.customer_id = pu.customer_id
JOIN app_users customer_user ON customer_user.user_id = c.user_id;

-- 7) CTE: summarize service workload by status.
WITH service_workload AS (
    SELECT service_status, COUNT(*) AS request_count
    FROM service_records
    GROUP BY service_status
)
SELECT service_status, request_count,
       ROUND(100.0 * request_count / NULLIF(SUM(request_count) OVER (), 0), 2) AS percentage
FROM service_workload
ORDER BY request_count DESC;

-- 8) Recursive CTE: walk backward through the status audit chain for one service.
--    Replace 1 with an existing service_id before running.
WITH RECURSIVE audit_history AS (
    SELECT a.audit_id, a.service_id, a.previous_audit_id,
           a.old_status, a.new_status, a.changed_at, 1 AS depth
    FROM service_status_audit a
    WHERE a.service_id = 1
      AND a.previous_audit_id IS NULL
    UNION ALL
    SELECT next_audit.audit_id, next_audit.service_id,
           next_audit.previous_audit_id, next_audit.old_status,
           next_audit.new_status, next_audit.changed_at, history.depth + 1
    FROM service_status_audit next_audit
    JOIN audit_history history
      ON next_audit.previous_audit_id = history.audit_id
)
SELECT * FROM audit_history ORDER BY depth;

-- Demonstration commands (run with a real service_id):
-- CALL update_service_status(1, 'in_progress');
-- SELECT * FROM get_service_status(1);
-- SELECT * FROM service_status_audit WHERE service_id = 1 ORDER BY audit_id;
