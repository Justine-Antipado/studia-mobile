// Feature toggles reuse /ai's own component and repository call
// (updateAiFeature), rather than a second copy that could drift from the
// switches on /ai — both read and write the same settings.ai object.
import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import * as aiRepo from '../../ai/data/aiRepository';
import FeatureToggles from '../../ai/components/FeatureToggles';
import Select from '../../../shared/components/Select';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

const LANGUAGES = ['English', 'Filipino'];

// `settings`/`setSettings` stay live (so a toggle here and on /ai never
// disagree); only the daily-limit number is a local edit buffer, seeded once
// from the initial value — rendered after `settings` has loaded, so no
// effect is needed to sync it in.
function AiSettingsForm({ settings, setSettings, save, saving }) {
  const [busyFeature, setBusyFeature] = useState(null);
  const [limit, setLimit] = useState(settings.ai.dailyRequestLimit);
  const { toast, showToast, showError, clearToast } = useToast();

  const onToggle = async (feature, enabled) => {
    setBusyFeature(feature);
    setSettings((s) => ({ ...s, ai: { ...s.ai, [feature]: enabled } }));
    try {
      await aiRepo.updateAiFeature(feature, enabled);
      showToast(`${feature} ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (e) {
      setSettings((s) => ({ ...s, ai: { ...s.ai, [feature]: !enabled } }));
      showError(e);
    } finally {
      setBusyFeature(null);
    }
  };

  const onSaveLimits = async () => {
    try {
      await save({ ai: { ...settings.ai, dailyRequestLimit: limit } });
      showToast('AI limits saved.');
    } catch (e) {
      showError(e);
    }
  };

  const onLanguageChange = async (language) => {
    try {
      await save({ ai: { ...settings.ai, language } });
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <div className="stack">
        <Card className="settings-card" title="Feature toggles">
          <FeatureToggles toggles={settings.ai} busyFeature={busyFeature} onToggle={onToggle} />
        </Card>

        <Card className="settings-card" title="Language & limits">
          <div className="two-col">
            <div className="field">
              <span>Language</span>
              <Select
                label="Language"
                value={settings.ai.language}
                options={LANGUAGES}
                onChange={onLanguageChange}
              />
            </div>
            <label className="field">
              <span>Daily request limit</span>
              <input type="number" min={100} className="input" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            </label>
          </div>
          <div className="form-footer">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={onSaveLimits}>
              {saving ? 'Saving…' : 'Save limits'}
            </button>
          </div>
        </Card>
      </div>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function AiSettings() {
  const { settings, error, loading, reload, save, saving, setSettings } = useSettings();

  return (
    <>
      <PageHeader title="AI settings" subtitle="Feature toggles, language and limits." />

      {loading && <Skeleton height={320} radius="var(--radius-lg)" />}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="Settings could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && settings && (
        <AiSettingsForm settings={settings} setSettings={setSettings} save={save} saving={saving} />
      )}
    </>
  );
}
