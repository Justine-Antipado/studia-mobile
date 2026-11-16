import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import * as api from '../services/api';
import { Card, Badge } from '../components/ui';
import { C } from '../theme';

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="bars" role="img" aria-label="User registrations per month">
      {data.map((d) => (
        <div className="bar-col" key={d.month} title={`${d.month}: ${d.count}`}>
          <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
          <span>{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ students, instructors }) {
  const total = students + instructors || 1;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const instrLen = (instructors / total) * circ;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" width="170" height="170" role="img" aria-label="Role distribution">
        <circle cx="70" cy="70" r={r} fill="none" stroke={C.primary} strokeWidth="26" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke={C.gold} strokeWidth="26"
          strokeDasharray={`${instrLen} ${circ - instrLen}`}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <p className="muted small">
        Students {Math.round((students / total) * 100)}% · Instructors {Math.round((instructors / total) * 100)}%
      </p>
    </div>
  );
}

export default function Home() {
  const { search } = useOutletContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getDashboard().then(setData);
  }, []);

  if (!data) return <div className="loading">Loading dashboard…</div>;
  const { stats, registrations, systemHealth, recent } = data;

  const tiles = [
    ['Total Users', stats.totalUsers],
    ['Students', stats.students],
    ['Instructors', stats.instructors],
    ['Active Today', stats.activeToday],
    ['Pending', stats.pending],
    ['AI Requests', stats.aiRequests],
  ];

  const q = search.trim().toLowerCase();
  const rows = recent.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <>
      <h1 className="page-title">Home</h1>

      <div className="stat-grid">
        {tiles.map(([label, value]) => (
          <div className="stat" key={label}>
            <small>{label}</small>
            <strong>{value.toLocaleString()}</strong>
          </div>
        ))}
      </div>

      <div className="grid-2-1">
        <Card title="User registrations">
          <BarChart data={registrations} />
        </Card>
        <Card title="Role distribution">
          <Donut students={stats.students} instructors={stats.instructors} />
        </Card>
      </div>

      <div className="grid-2-1">
        <Card title="Recent Registrations" action={<Link to="/users" className="link-danger">Delete Users</Link>}>
          <table className="table compact">
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.role}</td>
                  <td>{u.section}</td>
                  <td><Badge>{u.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="muted">No matching registrations.</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="System health">
          <ul className="health">
            <li>Storage {systemHealth.storageUsedPct}% used</li>
            <li>Server: <b className="ok">{systemHealth.server}</b></li>
            <li>AI service: <b className="ok">{systemHealth.aiService}</b></li>
          </ul>
        </Card>
      </div>
    </>
  );
}
