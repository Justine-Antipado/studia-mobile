import { useState } from 'react';
import { formatNumber } from '../../core/logic/format';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { C } from '../../theme';

/**
 * Hand-written SVG/HTML charts — no charting library, per the master prompt.
 * Every chart takes plain { label, value } data and is responsive; colors come
 * from theme tokens, never a hex typed in a page.
 *
 * Shared rules, so every chart on every page reads the same way:
 * - a value appears exactly ONCE per mark, in dark text outside the mark, never
 *   as light-on-light or dark-on-dark text inside it;
 * - a y-axis with evenly spaced ticks and dashed gridlines carries the scale;
 * - labels wrap rather than truncate, and no chart text is selectable, so a
 *   stray drag never leaves a highlight box behind;
 * - hover (and keyboard focus) highlights the mark and shows a tooltip with the
 *   label and the exact value;
 * - the marks animate in on first render.
 */

/** A round axis maximum, so the ticks come out as 0 / 250 / 500 rather than 0 / 237 / 474. */
const niceMax = (max) => {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = magnitude / 2 || 1;
  return Math.ceil(max / step) * step;
};

const TICK_COUNT = 4;
const ticksFor = (max) => Array.from({ length: TICK_COUNT + 1 }, (_, i) => (max / TICK_COUNT) * i);

/** Dashed gridlines plus their muted tick labels, shared by the bar and line charts. */
function Gridlines({ max, formatValue }) {
  return (
    <div className="chart-grid" aria-hidden="true">
      {ticksFor(max)
        .slice()
        .reverse()
        .map((t) => (
          <div className="chart-grid-row" key={t}>
            <span className="chart-tick">{formatValue(t)}</span>
            <span className="chart-gridline" />
          </div>
        ))}
    </div>
  );
}

const NARROW = '(max-width: 640px)';

export function BarChart({ data, valueKey = 'value', labelKey = 'label', formatValue = (v) => formatNumber(v) }) {
  const [hover, setHover] = useState(null);
  // Narrow screens switch to horizontal bars: the category names then have a
  // full line each and never need rotating or shortening.
  const horizontal = useMediaQuery(NARROW);
  const max = niceMax(Math.max(...data.map((d) => d[valueKey]), 1));

  const describe = (d) => `${d[labelKey]}: ${formatValue(d[valueKey])}`;

  if (horizontal) {
    return (
      <div
        className="hbar-chart"
        role="img"
        aria-label={`Bar chart: ${data.map(describe).join(', ')}`}
      >
        {data.map((d, i) => (
          <div className="hbar-row" key={d[labelKey]} style={{ '--i': i }} tabIndex={0} title={describe(d)}>
            <span className="hbar-label">{d[labelKey]}</span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ width: `${(d[valueKey] / max) * 100}%` }} />
            </span>
            <span className="hbar-value">{formatValue(d[valueKey])}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bar-chart" role="img" aria-label={`Bar chart: ${data.map(describe).join(', ')}`}>
      <div className="plot">
        <Gridlines max={max} formatValue={formatValue} />

        <div className="bars" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div
              className={'bar-col' + (hover === i ? ' on' : '')}
              key={d[labelKey]}
              style={{ '--i': i }}
              tabIndex={0}
              aria-label={describe(d)}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              {/* The value sits above the bar, in dark text on the card — never inside it. */}
              <span className="bar-value">{formatValue(d[valueKey])}</span>
              <span className="bar" style={{ height: `${(d[valueKey] / max) * 100}%` }}>
                {hover === i && <span className="chart-tip">{describe(d)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* The x-axis is a separate row, so a long name can wrap onto two lines. */}
      <div className="x-axis">
        {data.map((d, i) => (
          <span className={'x-label' + (hover === i ? ' on' : '')} key={d[labelKey]}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A line chart drawn as a single SVG polyline, with a tooltip per point. */
export function LineChart({
  data,
  valueKey = 'value',
  labelKey = 'label',
  height = 170,
  color = C.primary,
  formatValue = (v) => formatNumber(v),
}) {
  const width = 480;
  // The plot box reserves the headroom in CSS (.line-chart-plot padding-top),
  // so the viewBox maps 0 -> the baseline and `max` -> the top gridline.
  const padTop = 0;
  const padBottom = 0;
  const [hover, setHover] = useState(null);

  const max = niceMax(Math.max(...data.map((d) => d[valueKey]), 1));
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    const y = height - padBottom - (d[valueKey] / max) * (height - padTop - padBottom);
    return [x, y];
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height - padBottom} L${points[0][0]},${height - padBottom} Z`;
  const point = hover === null ? null : points[hover];

  return (
    <div className="line-chart">
      <div className="plot">
        <Gridlines max={max} formatValue={formatValue} />

        <div className="line-chart-plot">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Line chart: ${data.map((d) => `${d[labelKey]} ${formatValue(d[valueKey])}`).join(', ')}`}
            onMouseLeave={() => setHover(null)}
          >
            <path className="line-area" d={areaPath} fill={`${color}1A`} stroke="none" />
            <path
              className="line-path"
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map(([x, y], i) => (
              <g key={data[i][labelKey]}>
                <circle className="line-dot" cx={x} cy={y} r={hover === i ? 5.5 : 3.5} fill={color} />
                {/* A wide invisible target, so the point is easy to hit with a mouse. */}
                <circle
                  cx={x}
                  cy={y}
                  r="14"
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${data[i][labelKey]}: ${formatValue(data[i][valueKey])}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            ))}
          </svg>

          {point && (
            <div
              className="chart-tooltip"
              style={{ left: `${(point[0] / width) * 100}%`, top: `${point[1]}px` }}
              role="status"
            >
              <strong>{formatValue(data[hover][valueKey])}</strong>
              <small>{data[hover][labelKey]}</small>
            </div>
          )}
        </div>
      </div>

      <div className="x-axis line-chart-labels">
        {data.map((d, i) => (
          <span key={d[labelKey]} className={'x-label' + (hover === i ? ' on' : '')}>
            {d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * A donut with the total in the hole and a dotted legend underneath:
 * "● Students 1,196 (93%)  ● Instructors 88 (7%)". Hovering a segment swaps the
 * hole to that slice's own value.
 */
export function DonutChart({ slices, label, centerLabel = 'Total' }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const [hover, setHover] = useState(null);

  const pct = (value) => Math.round((value / total) * 100);

  const arcs = slices.reduce((acc, s) => {
    const len = (s.value / total) * circ;
    const prev = acc[acc.length - 1];
    acc.push({ ...s, len, offset: prev ? prev.offset + prev.len : 0 });
    return acc;
  }, []);

  const active = hover === null ? null : arcs[hover];

  return (
    <div className="donut-wrap">
      <div className="donut-plot">
        <svg viewBox="0 0 140 140" width="170" height="170" role="img" aria-label={label}>
          <g className="donut-arcs" onMouseLeave={() => setHover(null)}>
            {arcs.map((s, i) => (
              <circle
                key={s.label}
                className={'donut-arc' + (hover === i ? ' on' : '')}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === i ? 30 : 26}
                strokeDasharray={`${s.len} ${circ - s.len}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 70 70)"
                tabIndex={0}
                aria-label={`${s.label}: ${formatNumber(s.value)} (${pct(s.value)}%)`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
          </g>
        </svg>

        <div className="donut-center" role="status">
          <strong>{formatNumber(active ? active.value : total)}</strong>
          <small>{active ? `${active.label} · ${pct(active.value)}%` : centerLabel}</small>
        </div>
      </div>

      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className={hover === i ? 'on' : ''}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legend-dot" style={{ background: s.color }} aria-hidden="true" />
            <span className="legend-label">{s.label}</span>
            <strong>{formatNumber(s.value)}</strong>
            <span className="legend-pct">({pct(s.value)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
