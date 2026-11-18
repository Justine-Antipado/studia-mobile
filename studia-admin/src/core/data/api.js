/**
 * API layer — the ONLY file the UI talks to.
 *
 * Today every function delegates to the in-memory mock backend.
 * To connect a real database, swap each body for a fetch call, e.g.:
 *
 *   export const getUsers = () => http('/api/users');
 *
 * Component code does not need to change.
 */
import { backend } from './mock/mockBackend';

// Example helper for when you switch to a real REST API:
// const BASE = import.meta.env.VITE_API_URL;
// async function http(path, options = {}) {
//   const res = await fetch(BASE + path, {
//     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('studia_token')}` },
//     ...options,
//   });
//   if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
//   return res.json();
// }

export const login = (identifier, password) => backend.login(identifier, password);

export const getDashboard = () => backend.getDashboard();

export const getUsers = () => backend.getUsers();
export const blockUsers = (ids) => backend.blockUsers(ids);
export const deleteUsers = (ids) => backend.deleteUsers(ids);
export const approveUser = (id) => backend.approveUser(id);

export const getSettings = () => backend.getSettings();
export const saveSettings = (patch) => backend.saveSettings(patch);
export const runBackup = () => backend.runBackup();

export const sendOtp = () => backend.sendOtp();
export const verifyOtp = (code) => backend.verifyOtp(code);
export const updatePassword = (code, pw) => backend.updatePassword(code, pw);
