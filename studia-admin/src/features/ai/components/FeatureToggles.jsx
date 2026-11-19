import { FEATURE_LABELS } from '../logic/constants';
import { Toggle } from '../../../shared/components/ui';

/** One switch per AI feature — turns a feature off campus-wide without a deploy. */
export default function FeatureToggles({ toggles, busyFeature, onToggle }) {
  return (
    <ul className="toggle-list">
      {Object.entries(FEATURE_LABELS).map(([key, meta]) => (
        <li className="toggle-row" key={key}>
          <div className="toggle-row-text">
            <strong>{meta.label}</strong>
            <small>{meta.hint}</small>
          </div>
          <Toggle
            id={`ai-toggle-${key}`}
            checked={!!toggles[key]}
            disabled={busyFeature === key}
            label={meta.label}
            onChange={(next) => onToggle(key, next)}
          />
        </li>
      ))}
    </ul>
  );
}
