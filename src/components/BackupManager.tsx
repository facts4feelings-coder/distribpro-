import { useCallback, useEffect, useState } from 'react';
import {
  Database, Download, Upload, History, Trash2, AlertTriangle, CheckCircle2,
  Loader2, FileJson, RotateCcw,
} from 'lucide-react';
import {
  createBackup, downloadBackup, logBackup, parseBackupFile, restoreBackup, tableName,
} from '@/lib/backup';
import type { BackupFile } from '@/lib/backup';
import { api, type BackupHistoryDto } from '@/lib/api';

interface HistoryRow {
  id: string;
  created_at: string;
  kind: string;
  file_name: string | null;
  size_bytes: number | null;
  table_counts: Record<string, number>;
}

export default function BackupManager() {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMeta, setRestoreMeta] = useState<BackupFile['meta'] | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const data = await api.backup.history().catch(() => [] as BackupHistoryDto[]);
    setHistory(data.map((h) => ({
      id: h.id, created_at: h.createdAt, kind: h.kind, file_name: h.fileName,
      size_bytes: h.sizeBytes, table_counts: h.tableCounts,
    })));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runBackup = async () => {
    setBusy('backup');
    setError(null);
    setLastSummary(null);
    try {
      const backup = await createBackup();
      const fileName = downloadBackup(backup);
      await logBackup('download', fileName, backup);
      const totalRows = Object.values(backup.meta.tables).reduce((a, b) => a + b, 0);
      setLastSummary(`Backup saved — ${totalRows} records across ${Object.values(backup.meta.tables).filter((n) => n > 0).length} data sections.`);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    }
    setBusy(null);
  };

  const pickRestoreFile = (file: File | undefined) => {
    setRestoreError(null);
    setRestoreMeta(null);
    setRestoreFile(file ?? null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = parseBackupFile(String(reader.result));
        setRestoreMeta(backup.meta);
      } catch (e) {
        setRestoreError(e instanceof Error ? e.message : 'Invalid file');
        setRestoreFile(null);
      }
    };
    reader.readAsText(file);
  };

  const runRestore = async () => {
    if (!restoreFile) return;
    if (!confirm('Restore will merge this backup into your current data. Existing records with the same IDs will be updated. Continue?')) return;
    setBusy('restore');
    setError(null);
    setLastSummary(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = parseBackupFile(String(reader.result));
        const result = await restoreBackup(backup, (t) => setBusy(`restore:${tableName(t)}`));
        await logBackup('restore', restoreFile.name, backup);
        const total = result.restored.reduce((a, r) => a + r.rows, 0);
        if (result.errors.length > 0) {
          setError(`Restore finished with ${result.errors.length} problem section(s): ${result.errors.map((e) => tableName(e.table)).join(', ')}`);
        } else {
          setLastSummary(`Restore complete — ${total} records merged successfully.`);
        }
        setRestoreFile(null);
        setRestoreMeta(null);
        await loadHistory();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Restore failed');
      }
      setBusy(null);
    };
    reader.readAsText(restoreFile);
  };

  const removeEntry = async (id: string) => {
    await api.backup.deleteHistory(id);
    loadHistory();
  };

  const totalRecords = restoreMeta ? Object.values(restoreMeta.tables).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Download backup */}
        <div className="border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Download size={20} className="text-emerald-600" /></div>
            <h4 className="font-bold text-slate-800">Download Backup</h4>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Saves a complete copy of all your data (invoices, customers, products, vouchers, settings and more) as a file on this computer. Keep a copy somewhere safe.
          </p>
          <button
            onClick={runBackup}
            disabled={busy !== null}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          >
            {busy === 'backup' ? <><Loader2 size={16} className="animate-spin" /> Preparing...</> : <><Download size={16} /> Download Full Backup</>}
          </button>
        </div>

        {/* Restore backup */}
        <div className="border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Upload size={20} className="text-amber-600" /></div>
            <h4 className="font-bold text-slate-800">Restore from Backup</h4>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Bring data back from a backup file. Records are merged in — nothing is deleted, matching records are updated.
          </p>
          <label className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-lg text-sm font-medium text-slate-600 transition-all">
            {restoreFile ? <FileJson size={16} className="text-amber-600" /> : <Upload size={16} />}
            {restoreFile ? restoreFile.name : 'Choose backup file (.json)'}
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => pickRestoreFile(e.target.files?.[0])} />
          </label>
          {restoreMeta && (
            <p className="text-xs text-slate-500 mt-2">
              Valid backup — {totalRecords} records, created {new Date(restoreMeta.created_at).toLocaleString()}
            </p>
          )}
          {restoreError && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {restoreError}</p>
          )}
          <button
            onClick={runRestore}
            disabled={!restoreFile || busy !== null}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 mt-3"
          >
            {busy?.startsWith('restore') ? <><Loader2 size={16} className="animate-spin" /> Restoring {busy.includes(':') ? busy.split(':')[1] : '...'}...</> : <><RotateCcw size={16} /> Restore Data</>}
          </button>
        </div>
      </div>

      {lastSummary && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
          <CheckCircle2 size={16} /> {lastSummary}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* History */}
      <div className="border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><History size={18} className="text-slate-600" /></div>
          <h4 className="font-bold text-slate-800">Backup Activity</h4>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No backups taken yet. Download your first backup above.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((h) => {
              const rows = Object.values(h.table_counts ?? {}).reduce((a, b) => a + Number(b), 0);
              return (
                <div key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    {h.kind === 'restore' ? (
                      <Upload size={15} className="text-amber-500" />
                    ) : (
                      <Download size={15} className="text-emerald-500" />
                    )}
                    <div>
                      <p className="font-medium text-slate-700">
                        {h.kind === 'restore' ? 'Data restored' : 'Backup downloaded'}
                        {h.file_name && <span className="text-slate-400 font-normal"> — {h.file_name}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(h.created_at).toLocaleString()}{rows > 0 ? ` · ${rows} records` : ''}
                        {h.size_bytes ? ` · ${(h.size_bytes / 1024).toFixed(0)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removeEntry(h.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remove from history">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Database size={12} />
        Tip: take a backup at least once a week, and always before restoring or making big changes.
      </p>
    </div>
  );
}
