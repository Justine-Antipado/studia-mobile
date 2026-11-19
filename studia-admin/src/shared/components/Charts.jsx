import { C } from '../../theme';

/**
 * Hand-written SVG charts — no charting library, per the master prompt.
 * Every chart takes plain { label, value } data and is responsive via
 * viewBox + percentage width; colors come from theme tokens, never a hex
 * typed in a page.
 */

export function BarChart({ data, valueKey = 'value', labelKey = 'label', formatValue = (v) => v }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="bars" role="img" aria-label={`Bar chart: ${data.map((d) => `${d[labelKey]} ${d[valueKey]}`).join(', ')}`}>
      {data.map((d) => (
        <div className="bar-col" key={d[labelKey]} title={`${d[labelKey]}: ${formatValue(d[valueKey])}`}>
          <div className="bar" style={{ height: `${(d[valueKey] / max) * 100}%` }} />
          <span>{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

/** A smooth-ish line chart drawn as a single SVG polyline over a fixed viewBox. */
export function LineChart({ data, valueKey = 'value', labelKey = 'label', height = 160, color = C.primary }) {
  const width = 480;
  const pad = 12;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = height - pad - (d[valueKey] / max) * (height - pad * 2);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height - pad} L${points[0][0]},${height - pad} Z`;

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Line chart: ${data.map((d) => `${d[labelKey]} ${d[valueKey]}`).join(', ')}`}
      >
        <path d={areaPath} fill={`${color}1A`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <circle key={data[i][labelKey]} cx={x} cy={y} r="3.5" fill={color} />
        ))}
      </svg>
      <div className="line-chart-labels">
        {data.map((d) => (
          <span key={d[labelKey]}>{d[labelKey]}</span>
        ))}
      </div>
    </div>
  );
}

/** A two-slice donut (e.g. students vs. instructors). Extend `slices` to add more. */
export function DonutChart({ slices, label }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const arcs = slices.reduce((acc, s) => {
    const len = (s.value / total) * circ;
    const prev = acc[acc.length - 1];
    acc.push({ ...s, len, offset: prev ? prev.offset + prev.len : 0 });
    return acc;
  }, []);

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" width="170" height="170" role="img" aria-label={label}>
        {arcs.map((s) => (
          <circle
            key={s.label}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="26"
            strokeDasharray={`${s.len} ${circ - s.len}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 70 70)"
          />
        ))}
      </svg>
      <p className="muted small donut-legend">
        {slices.map((s, i) => (
          <span key={s.label}>
            {i > 0 && ' · '}
            {s.label} {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </p>
    </div>
  );
}
