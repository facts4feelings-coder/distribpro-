import { useEffect, useState } from 'react';
import { api, settingsDtoToLegacy } from '@/lib/api';
import type { Settings } from '@/lib/types';

// Phase 2: settings come from SQLite via the main process. Consumers keep
// receiving the legacy snake_case Settings shape through the adapter, so
// none of the 26 pages using this hook had to change.
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dto = await api.settings.get();
        setSettings(settingsDtoToLegacy(dto));
      } catch {
        setSettings(null);
      }
      setLoading(false);
    })();
  }, []);

  return { settings, setSettings, loading };
}
