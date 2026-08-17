-- ============================================
-- Migration 002: Graph Data Model
-- Ticket: KSA-153
-- ============================================

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_symbol_id INTEGER NOT NULL,
    target_symbol TEXT NOT NULL,
    target_symbol_id INTEGER,
    kind TEXT NOT NULL CHECK(kind IN ('calls','imports','inherits','implements','uses','decorates')),
    file_path TEXT NOT NULL,
    line INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (source_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
    FOREIGN KEY (target_symbol_id) REFERENCES symbols(id) ON DELETE SET NULL
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS idx_rel_source_kind ON relationships(source_symbol_id, kind);
CREATE INDEX IF NOT EXISTS idx_rel_target_kind ON relationships(target_symbol, kind);
CREATE INDEX IF NOT EXISTS idx_rel_target_id ON relationships(target_symbol_id) WHERE target_symbol_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rel_file ON relationships(file_path);
