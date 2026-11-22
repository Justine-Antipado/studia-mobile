import Select from '../../../shared/components/Select';
import { COURSES, DEPARTMENTS, SECTIONS, YEARS } from '../../../core/logic/validation';

// `dot` colours the status options in the menu.
const STATUS_OPTIONS = [
  { value: 'All', label: 'All statuses' },
  { value: 'Active', label: 'Active', dot: 'green' },
  { value: 'Inactive', label: 'Inactive', dot: 'grey' },
];
const withAll = (all, values, labelFor = (v) => String(v)) => [
  { value: 'All', label: all },
  ...values.map((v) => ({ value: v, label: labelFor(v) })),
];

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
      <div className="field">
        <span>Course</span>
        <Select
          label="Course"
          searchable
          value={query.course}
          options={withAll('All courses', COURSES)}
          onChange={(course) => onChange({ course })}
        />
      </div>
      <div className="field">
        <span>Year</span>
        <Select
          label="Year"
          value={query.year}
          options={withAll('All years', YEARS, (y) => 'Year ' + y)}
          onChange={(year) => onChange({ year })}
        />
      </div>
      <div className="field">
        <span>Section</span>
        <Select
          label="Section"
          value={query.section}
          options={withAll('All sections', SECTIONS)}
          onChange={(section) => onChange({ section })}
        />
      </div>
      <div className="field">
        <span>Department</span>
        <Select
          label="Department"
          searchable
          value={query.department}
          options={withAll('All departments', DEPARTMENTS)}
          onChange={(department) => onChange({ department })}
        />
      </div>
      <div className="field">
        <span>Status</span>
        <Select
          label="Status"
          value={query.status}
          options={STATUS_OPTIONS}
          onChange={(status) => onChange({ status })}
        />
      </div>
    </div>
  );
}
