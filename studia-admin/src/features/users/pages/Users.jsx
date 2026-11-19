// TODO(refactor): split UI / logic / data
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import * as api from '../../../core/data/api';
import { Avatar, Badge, Card, Icon, Modal, Toast } from '../../../shared/components/ui';
import { flashElement } from '../../../shared/utils/flash';

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
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const clearToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    api.getUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  // Arriving from the global search: show all users, then scroll to and flash the chosen row.
  const highlightId = location.state?.highlight;
  const handledKey = useRef(null);
  useEffect(() => {
    if (loading || highlightId == null || handledKey.current === location.key) return;
    handledKey.current = location.key;
    setFilter('All');
    const t = setTimeout(() => flashElement(document.querySelector(`[data-user-row="${highlightId}"]`)), 60);
    return () => clearTimeout(t);
  }, [loading, highlightId, location.key]);

  const visible = useMemo(() => users.filter((u) => matchesFilter(u, filter)), [users, filter]);

  const selectedUsers = users.filter((u) => selected.has(u.id));
  const blockIds = selectedUsers.filter((u) => u.status === 'Active').map((u) => u.id);
  const unblockIds = selectedUsers.filter((u) => u.status === 'Blocked').map((u) => u.id);
  const count = selectedUsers.length;

  const allChecked = visible.length > 0 && visible.every((u) => selected.has(u.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(visible.map((u) => u.id)));
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** kind: 'block' | 'unblock'. Bulk actions clear the selection; per-row actions leave it alone. */
  const changeStatus = async (kind, ids, { bulk = false } = {}) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      setUsers(kind === 'block' ? await api.blockUsers(ids) : await api.unblockUsers(ids));
      setToast(`${ids.length} user(s) ${kind === 'block' ? 'blocked' : 'unblocked'}.`);
      if (bulk) setSelected(new Set());
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    const ids = selectedUsers.map((u) => u.id);
    setBusy(true);
    try {
      setUsers(await api.deleteUsers(ids));
      setToast(`${ids.length} user(s) deleted.`);
      setSelected(new Set());
    } catch (e) {
      setToast(e.message);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const approve = async (id) => {
    setUsers(await api.approveUser(id));
    setToast('User approved.');
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Users</h1>
        <div className="head-actions">
          <button className="btn btn-green" disabled={!unblockIds.length || busy} onClick={() => changeStatus('unblock', unblockIds, { bulk: true })}>
            <Icon.Unlock /> Unblock ({unblockIds.length})
          </button>
          <button className="btn btn-orange" disabled={!blockIds.length || busy} onClick={() => changeStatus('block', blockIds, { bulk: true })}>
            <Icon.Lock /> Block ({blockIds.length})
          </button>
          <button className="btn btn-red" disabled={!count || busy} onClick={() => setConfirmDelete(true)}>
            <Icon.Close /> Delete ({count})
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
                  <tr key={u.id} data-user-row={u.id}>
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
                      {u.status === 'Active' && (
                        <button className="link-btn warn" disabled={busy} onClick={() => changeStatus('block', [u.id])}>Block</button>
                      )}
                      {u.status === 'Blocked' && (
                        <button className="link-btn" disabled={busy} onClick={() => changeStatus('unblock', [u.id])}>Unblock</button>
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

      {confirmDelete && (
        <Modal
          title={`Delete ${count} user${count === 1 ? '' : 's'}?`}
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-red" disabled={busy} onClick={runDelete}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          }
        >
          {count === 1 ? <><b>{selectedUsers[0].name}</b> will be</> : `${count} users will be`} permanently removed. This can’t be undone.
        </Modal>
      )}

      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
