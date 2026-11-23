// Phase 6: AI usage and health — requests over time, per-feature latency and
// error rate, the transcription queue and its failures, the AI-generated
// quiz mix by Bloom level and difficulty, the monthly quota/cost estimate,
// and the on/off switches the brief asks this page to carry (phase 7's
// /settings/ai reads the same settings.ai source, so the two can't disagree).
import { useState } from 'react';
import * as aiRepo from '../data/aiRepository';
import FeatureToggles from '../components/FeatureToggles';
import { FEATURE_LABELS } from '../logic/constants';
import { formatDate, formatNumber, formatPercent } from '../../../core/logic/format';
import { BarChart, LineChart } from '../../../shared/components/Charts';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton, SkeletonCards } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import { Card, Toast } from '../../../shared/components/ui';
import { useAsync, useToast } from '../../../shared/hooks';

export default function AiHealth() {
  const { data, error, loading, reload, setData } = useAsync((signal) => aiRepo.getAiHealth({ signal }), []);
  const [toggleBusy, setToggleBusy] = useState(null);
  const { toast, showToast, showError, clearToast } = useToast();

  const handleToggle = async (feature, enabled) => {
    setToggleBusy(feature);
    setData((prev) => prev && { ...prev, toggles: { ...prev.toggles, [feature]: enabled } });
    try {
      await aiRepo.updateAiFeature(feature, enabled);
      showToast(`${FEATURE_LABELS[feature].label} ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (e) {
      setData((prev) => prev && { ...prev, toggles: { ...prev.toggles, [feature]: !enabled } });
      showError(e);
    } finally {
      setToggleBusy(null);
    }
  };

  const avgLatency = data
    ? Math.round(data.featureHealth.reduce((sum, f) => sum + f.avgLatencyMs, 0) / data.featureHealth.length)
    : 0;
  const avgErrorRate = data
    ? data.featureHealth.reduce((sum, f) => sum + f.errorRatePct, 0) / data.featureHealth.length
    : 0;
  const quotaUsedPct = data ? Math.round((data.quota.requestsUsed / data.quota.requestsQuota) * 100) : 0;

  return (
    <>
      <PageHeader title="AI health" subtitle="Requests, queue health, quiz mix and feature switches for the AI core." />

      {loading && (
        <>
          <SkeletonCards count={4} />
          <div className="grid-2-1">
            <Skeleton height={260} radius="var(--radius-lg)" />
            <Skeleton height={260} radius="var(--radius-lg)" />
          </div>
        </>
      )}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="AI health could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && data && (
        <>
          <div className="stat-grid stat-grid-4">
            <StatCard label="Requests this month" value={data.requestsTrend.at(-1)?.count ?? 0} />
            <StatCard label="Avg. latency" value={`${formatNumber(avgLatency)} ms`} />
            <StatCard label="Avg. error rate" value={formatPercent(avgErrorRate, 1)} />
            <StatCard label="Daily quota used" value={formatPercent(quotaUsedPct)} />
          </div>

          <div className="two-col">
            <Card title="AI requests over time">
              <LineChart data={data.requestsTrend} valueKey="count" labelKey="month" />
            </Card>
            <Card title="Requests by feature">
              <BarChart data={data.usageByFeature} valueKey="count" labelKey="feature" />
            </Card>
          </div>

          <div className="two-col">
            <Card
              title="Transcription queue"
              subtitle={`${data.transcription.queued} queued${data.transcription.avgProcessingSec ? ` · ~${data.transcription.avgProcessingSec}s avg. processing` : ''}`}
            >
              {data.transcription.failures.length === 0 ? (
                <p className="muted small">No transcription failures.</p>
              ) : (
                <ul className="dt-cards">
                  {data.transcription.failures.map((f) => (
                    <li className="dt-card" key={f.id}>
                      <div className="dt-card-head">
                        <div className="dt-card-title">{f.title}</div>
                      </div>
                      <dl className="dt-card-body">
                        <div className="dt-card-row">
                          <dt>Class</dt>
                          <dd>{f.className}</dd>
                        </div>
                        <div className="dt-card-row">
                          <dt>Owner</dt>
                          <dd>{f.ownerName}</dd>
                        </div>
                        <div className="dt-card-row">
                          <dt>Posted</dt>
                          <dd>{formatDate(f.postedAt)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="AI-generated quizzes">
              <p className="muted small">By Bloom level</p>
              <BarChart data={data.quizGeneration.byBloom} />
              <p className="muted small" style={{ marginTop: 'var(--space-4)' }}>
                By difficulty
              </p>
              <BarChart data={data.quizGeneration.byDifficulty} />
            </Card>
          </div>

          <div className="grid-2-1">
            <Card title="Feature switches" subtitle="Turn an AI feature off campus-wide without a deploy.">
              <FeatureToggles toggles={data.toggles} busyFeature={toggleBusy} onToggle={handleToggle} />
            </Card>
            <Card title="Daily quota & cost">
              <div
                className="meter"
                role="progressbar"
                aria-label="Daily AI request quota used"
                aria-valuenow={quotaUsedPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    width: `${quotaUsedPct}%`,
                    background: quotaUsedPct > 85 ? 'var(--red-strong)' : 'var(--primary)',
                  }}
                />
              </div>
              <p className="muted small">
                {formatNumber(data.quota.requestsUsed)} / {formatNumber(data.quota.requestsQuota)} requests used today
              </p>
              <p className="muted small">Estimated cost this month: ${data.quota.costEstimateUsd.toFixed(2)}</p>
              <p className="muted small">Resets {formatDate(data.quota.resetsOn)}</p>
            </Card>
          </div>
        </>
      )}

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
