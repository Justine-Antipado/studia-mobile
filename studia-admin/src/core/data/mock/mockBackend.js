/**
 * MOCK BACKEND
 * ----------------------------------------------------------------------------
 * Everything in this file pretends to run on the server. When you build the real
 * backend, delete this file and make the functions in api.js call your REST API.
 *
 * There is exactly ONE admin account and it is hard-coded here on purpose:
 * admins cannot register. In production, keep these credentials server-side
 * (env vars / hashed in DB) — never ship them in a browser bundle.
 */
import { mockUsers, mockStats, mockRegistrations, mockSystemHealth, mockSettings } from './mockData';

const ADMIN_ACCOUNT = {
  id: 'admin-1',
  name: 'OMSU Administrator',
  username: 'admin',
  email: 'admin@omsu.edu.ph',
  password: 'Studia@2026', // hard-coded for now
};

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

// in-memory "database"
const db = {
  users: structuredClone(mockUsers),
  settings: structuredClone(mockSettings),
  adminPassword: ADMIN_ACCOUNT.password,
  otp: null, // { code, expiresAt }
};

export const backend = {
  async login(identifier, password) {
    await delay();
    const id = identifier.trim().toLowerCase();
    const match = id === ADMIN_ACCOUNT.email.toLowerCase() || id === ADMIN_ACCOUNT.username.toLowerCase();
    if (!match || password !== db.adminPassword) {
      throw new Error('Invalid email/username or password.');
    }
    const { password: _pw, ...admin } = ADMIN_ACCOUNT;
    return { token: 'mock-token-' + Date.now(), admin };
  },

  async getDashboard() {
    await delay();
    const users = db.users;
    return {
      stats: {
        ...mockStats,
        pending: users.filter((u) => u.status === 'Pending').length,
      },
      registrations: mockRegistrations,
      systemHealth: mockSystemHealth,
      recent: [...users].slice(-3).reverse(),
    };
  },

  async getUsers() {
    await delay(200);
    return structuredClone(db.users);
  },

  // Statuses: 'Active' | 'Blocked' | 'Pending'. Block only touches Active users, unblock only Blocked ones.
  async blockUsers(ids) {
    await delay();
    db.users = db.users.map((u) => (ids.includes(u.id) && u.status === 'Active' ? { ...u, status: 'Blocked' } : u));
    return structuredClone(db.users);
  },

  async unblockUsers(ids) {
    await delay();
    db.users = db.users.map((u) => (ids.includes(u.id) && u.status === 'Blocked' ? { ...u, status: 'Active' } : u));
    return structuredClone(db.users);
  },

  async deleteUsers(ids) {
    await delay();
    db.users = db.users.filter((u) => !ids.includes(u.id));
    return structuredClone(db.users);
  },

  async approveUser(id) {
    await delay(200);
    db.users = db.users.map((u) => (u.id === id ? { ...u, status: 'Active' } : u));
    return structuredClone(db.users);
  },

  async getSettings() {
    await delay(200);
    return structuredClone(db.settings);
  },

  async saveSettings(patch) {
    await delay();
    db.settings = { ...db.settings, ...patch };
    return structuredClone(db.settings);
  },

  async runBackup() {
    await delay(900);
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    db.settings.backup = { lastBackup: `${now} · 1.8 GB`, ok: true };
    return structuredClone(db.settings.backup);
  },

  // --- Password change with OTP ---
  async sendOtp() {
    await delay();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.otp = { code, expiresAt: Date.now() + db.settings.email.otpExpiryMinutes * 60 * 1000 };
    // A real backend emails this. Here it is logged so you can test the flow.
    console.info('[mock] OTP sent to', ADMIN_ACCOUNT.email, '→', code);
    return { sentTo: ADMIN_ACCOUNT.email, devCode: code };
  },

  async verifyOtp(code) {
    await delay(250);
    if (!db.otp || Date.now() > db.otp.expiresAt) throw new Error('OTP expired. Please request a new one.');
    if (db.otp.code !== code) throw new Error('Incorrect OTP.');
    return true;
  },

  async updatePassword(code, newPassword) {
    await delay();
    if (!db.otp || db.otp.code !== code || Date.now() > db.otp.expiresAt) {
      throw new Error('OTP is invalid or expired.');
    }
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    db.adminPassword = newPassword;
    db.otp = null;
    return true;
  },
};
