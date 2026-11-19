// Phase 7: security posture checklist and scanner-style findings. Read-only
// — "findings come from the API; use mock data now" (master prompt, 5).
import * as securityRepo from '../data/securityRepository';
import { ROUTES } from '../../../core/config/routes';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonCards } from '../../../shared/components/Skeleton';
import { Badge } from '../../../shared/components/ui';
import { useAsync } from '../../../shared/hooks';

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function Vulnerabilities() {
  const { data, error, loading, reload } = useAsync((signal) => securityRepo.getVulnerabilities({ signal }), []);
  const findings = [...(data ?? [])].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <>
      <PageHeader title="Vulnerabilities" subtitle="Security posture checklist and findings, with recommended fixes." back={ROUTES.security} />

      {loading && <SkeletonCards count={6} height={120} />}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="Findings could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && findings.length === 0 && (
        <EmptyState title="No findings" message="The posture checklist is empty." />
      )}

      {!loading && !error && findings.length > 0 && (
        <ul className="dt-cards">
          {findings.map((f) => (
            <li className="dt-card" key={f.id}>
              <div className="finding-head">
                <div>
                  <p className="finding-category">{f.category}</p>
                  <strong>{f.title}</strong>
                </div>
                <Badge>{f.severity}</Badge>
              </div>
              <p className="muted small">{f.description}</p>
              <p className="finding-fix">
                <strong>Recommended fix — </strong>
                {f.recommendation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
