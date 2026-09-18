CREATE OR REPLACE FUNCTION prevent_audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_immutable
ON audit_log;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_changes();

CREATE OR REPLACE FUNCTION prevent_audit_log_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log cannot be truncated';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_truncate
ON audit_log;

CREATE TRIGGER audit_log_no_truncate
BEFORE TRUNCATE ON audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_truncate();