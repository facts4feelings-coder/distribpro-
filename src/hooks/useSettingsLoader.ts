import { useEffect } from 'react';
import { api } from '@/lib/api';

export function useSettingsLoader() {
  useEffect(() => {
    (async () => {
      try {
        const dto = await api.settings.get();
        document.title = `${dto.companyName} — DistribPro`;
      } catch {
        // Title stays default outside Electron (e.g. plain browser dev).
      }
    })();
  }, []);
}
