CREATE TABLE IF NOT EXISTS backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'download',
  file_name text,
  size_bytes integer,
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_backup_history" ON backup_history FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_backup_history" ON backup_history FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "delete_backup_history" ON backup_history FOR DELETE
  TO authenticated USING (true);
