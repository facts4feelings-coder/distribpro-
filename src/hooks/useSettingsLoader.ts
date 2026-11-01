import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSettingsLoader() {
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (!data) return;
      document.title = `${data.company_name} — DistribPro`;
    })();
  }, []);
}
