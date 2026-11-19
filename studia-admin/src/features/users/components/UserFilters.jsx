import { COURSES, DEPARTMENTS, SECTIONS, YEARS } from '../../../core/logic/validation';

const STATUSES = ['Active', 'Inactive'];

/**
 * The /users filter bar. Every control is a labelled field, and every change
 * goes straight back into the URL-synced query state, so a filtered view can
 * be bookmarked and shared.
 *
 * query: the current { q, course, year, section, department, status }
 * onChange: partial update, e.g. onChange({ course: 'BSIT' })
 */
export default function UserFilters({ query, onChange }) {
  return (
    <div className="filters">
      <label className="field search">
        <span>Search</span>
        <input
          className="input"
          value={query.q}
          placeholder="Name or email"
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Course</span>
        <select className="input" value={query.course} onChange={(e) => onChange({ course: e.target.value })}>
          <option value="All">All courses</option>
          {COURSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Year</span>
        <select className="input" value={query.year} onChange={(e) => onChange({ year: e.target.value })}>
          <option value="All">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>Year {y}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Section</span>
        <select className="input" value={query.section} onChange={(e) => onChange({ section: e.target.value })}>
          <option value="All">All sections</option>
          {SECTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Department</span>
        <select className="input" value={query.department} onChange={(e) => onChange({ department: e.target.value })}>
          <option value="All">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Status</span>
        <select className="input" value={query.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="All">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
