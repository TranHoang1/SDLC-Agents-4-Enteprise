-- KSA-296: KB Sensitive Data Masking tables
CREATE TABLE IF NOT EXISTS masking_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  regex_pattern TEXT,
  mask_format TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('pii', 'credential', 'business')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sensitivity_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')),
  source TEXT NOT NULL CHECK(source IN ('auto', 'manual')),
  confidence REAL NOT NULL DEFAULT 0,
  confirmed_by TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entry_id)
);

CREATE TABLE IF NOT EXISTS masking_allowlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('entry_id', 'tag', 'source', 'pattern')),
  rule_value TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS masking_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  requester_id TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  action TEXT NOT NULL,
  patterns_matched TEXT,
  sensitivity_level TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON masking_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entry ON masking_audit_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_classification_entry ON sensitivity_classifications(entry_id);

INSERT OR IGNORE INTO masking_config (pattern_type, enabled, mask_format, category) VALUES
  ('email', 1, 'u***@d***.com', 'pii'),
  ('phone', 1, '+X-***-***-XXXX', 'pii'),
  ('ip', 1, 'X.X.*.*', 'pii'),
  ('credit_card', 1, '****-****-****-XXXX', 'pii'),
  ('ssn', 1, '***-**-XXXX', 'pii'),
  ('api_key', 1, '[REDACTED]', 'credential'),
  ('jwt', 1, 'eyJ***[REDACTED]', 'credential'),
  ('password', 1, '[REDACTED]', 'credential'),
  ('connection_string', 1, '[REDACTED_URI]', 'credential'),
  ('private_key', 1, '[REDACTED_KEY]', 'credential');
