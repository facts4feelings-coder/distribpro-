import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Settings } from '@/lib/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      setSettings(data as Settings | null);
      setLoading(false);
    })();
  }, []);

  return { settings, setSettings, loading };
}
