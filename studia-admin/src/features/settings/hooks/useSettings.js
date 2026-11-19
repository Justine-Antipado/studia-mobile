import { useCallback } from 'react';
import * as settingsRepo from '../data/settingsRepository';
import { useAsync, useMutation } from '../../../shared/hooks';

/**
 * Shared by every /settings/* sub-page: loads the one settings document and
 * exposes a `save(patch)` that writes through and updates local state, so
 * each page only has to own its own slice's form fields.
 */
export function useSettings() {
  const { data, error, loading, reload, setData } = useAsync((signal) => settingsRepo.getSettings({ signal }));
  const { mutate, pending } = useMutation(settingsRepo.saveSettings);

  const save = useCallback(
    async (patch) => {
      const next = await mutate(patch);
      setData(next);
      return next;
    },
    [mutate, setData]
  );

  return { settings: data, error, loading, reload, save, saving: pending, setSettings: setData };
}
