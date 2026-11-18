// TODO(refactor): split UI / logic / data
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import * as api from '../../../core/data/api';
import { Avatar, Badge, Card, Icon, Modal, Toast } from '../../../shared/components/ui';

const FILTERS = ['All', 'Students', 'Instructors', 'Pending', 'Blocked'];

function matchesFilter(u, f) {
  switch (f) {
    case 'Students': return u.role === 'Student';
    case 'Instructors': return u.role === 'Instructor';
    case 'Pending': return u.status === 'Pending';
    case 'Blocked': return u.status === 'Blocked';
    default: return true;
  }
}

function exportCsv(rows) {
  const head = ['Name', 'Email', 'Role', 'Section/Dept', 'Status', 'Joined', 'Last active'];
  const lines = rows.map((u) =>
    [u.name, u.email, u.role, u.section, u.status, u.joined, u.lastActive].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'studia-users.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Users() {
  const { search } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(new Set());
  const [confirm, setConfirm] = useState(null); // 'block' | 'delete' | null
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const clearToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    api.getUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) => matchesFilter(u, filter) && (!q || [u.name, u.email, u.section, u.role].some((v) => v.toLowerCase().includes(q)))
    );
  }, [users, filter, search]);

  const allChecked = visible.length > 0 && visible.every((u) => selected.has(u.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(visible.map((u) => u.id)));
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const runAction = async () => {
    const ids = [...selected];
    setBusy(true);
    try {
      const updated = confirm === 'block' ? await api.blockUsers(ids) : await api.deleteUsers(ids);
      setUsers(updated);
      setToast(confirm === 'block' ? `${ids.length} user(s) blocked.` : `${ids.length} user(s) deleted.`);
      setSelected(new Set());
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const approve = async (id) => {
    setUsers(await api.approveUser(id));
    setToast('User approved.');
  };

  const count = selected.size;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Users</h1>
        <div className="head-actions">
          <button className="btn btn-orange" disabled={!count} onClick={() => setConfirm('block')}>
            <Icon.Lock /> Block Users ({count})
          </button>
          <button className="btn btn-red" disabled={!count} onClick={() => setConfirm('delete')}>
            <Icon.Close /> Delete Users ({count})
          </button>
        </div>
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <Card>
        {loading ? (
          <div className="loading">Loading users…</div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
                  <th>Name</th><th>Email</th><th>Role</th><th>Section / Dept</th><th>Status</th><th>Joined</th><th>Last active</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} aria-label={`Select ${u.name}`} /></td>
                    <td>
                      <div className="name-cell"><Avatar name={u.name} /><strong>{u.name}</strong></div>
                    </td>
                    <td>{u.email}</td>
                    <td><Badge>{u.role}</Badge></td>
                    <td>{u.section}</td>
                    <td>
                      <Badge>{u.status}</Badge>
                      {u.status === 'Pending' && (
                        <button className="link-btn" onClick={() => approve(u.id)}>Approve</button>
                      )}
                    </td>
                    <td>{u.joined}</td>
                    <td>{u.lastActive}</td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="muted center">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="table-foot">
          Showing {visible.length} of {users.length.toLocaleString()} · Rows per page: 10 ·{' '}
          <button className="link-btn" onClick={() => exportCsv(visible)}>Export CSV</button>
        </p>
      </Card>

      {confirm && (
        <Modal
          title={confirm === 'block' ? 'Block selected users?' : 'Delete selected users?'}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={`btn ${confirm === 'block' ? 'btn-orange' : 'btn-red'}`} disabled={busy} onClick={runAction}>
                {busy ? 'Working…' : confirm === 'block' ? 'Block' : 'Delete'}
              </button>
            </>
          }
        >
          {confirm === 'block'
            ? `${count} user(s) will no longer be able to log in to STUDIA.`
            : `${count} user(s) will be permanently removed. This can’t be undone.`}
        </Modal>
      )}

      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
