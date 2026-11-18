// Mock data — replace with real DB queries later (see src/services/api.js).

export const mockUsers = [
  { id: 1, name: 'Juan Dela Cruz', email: 'juan.delacruz@omsu.edu.ph', role: 'Student', section: 'BSIT 3-A', status: 'Active', joined: 'Aug 12, 2026', lastActive: 'Today' },
  { id: 2, name: 'Ana Villanueva', email: 'ana.v@omsu.edu.ph', role: 'Student', section: 'BSIT 3-A', status: 'Active', joined: 'Aug 12, 2026', lastActive: 'Today' },
  { id: 3, name: 'Prof. Maria Santos', email: 'maria.santos@omsu.edu.ph', role: 'Instructor', section: 'IT Dept', status: 'Active', joined: 'Jun 3, 2026', lastActive: 'Today' },
  { id: 4, name: 'Mark Bautista', email: 'mark.b@omsu.edu.ph', role: 'Student', section: 'BSIT 3-A', status: 'Blocked', joined: 'Aug 14, 2026', lastActive: 'Nov 2' },
  { id: 5, name: 'Prof. Ramon Reyes', email: 'ramon.r@omsu.edu.ph', role: 'Instructor', section: 'IT Dept', status: 'Pending', joined: 'Nov 14, 2026', lastActive: '—' },
  { id: 6, name: 'Liza Mercado', email: 'liza.m@omsu.edu.ph', role: 'Student', section: 'BSIT 3-B', status: 'Active', joined: 'Aug 15, 2026', lastActive: 'Yesterday' },
  { id: 7, name: 'Carlo Dizon', email: 'carlo.d@omsu.edu.ph', role: 'Student', section: 'BSIT 3-C', status: 'Deactivated', joined: 'Aug 16, 2026', lastActive: 'Oct 10' },
];

export const mockStats = {
  totalUsers: 1284,
  students: 1196,
  instructors: 88,
  activeToday: 412,
  pending: 9,
  aiRequests: 2340,
};

export const mockRegistrations = [
  { month: 'Jun', count: 60 },
  { month: 'Jul', count: 110 },
  { month: 'Aug', count: 85 },
  { month: 'Sep', count: 140 },
  { month: 'Oct', count: 120 },
  { month: 'Nov', count: 175 },
];

export const mockSystemHealth = {
  storageUsedPct: 62,
  server: 'Online',
  aiService: 'Operational',
};

export const mockSettings = {
  term: { schoolYear: '2026–2027', semester: '1st Semester', startDate: '2026-08-11', endDate: '2026-12-18' },
  email: { senderEmail: 'no-reply@omsu.edu.ph', otpExpiryMinutes: 5, requireOtpForReset: true, resendSeconds: 60 },
  system: { maintenanceMode: false, appVersion: 'v1.0.0', upToDate: true },
  backup: { lastBackup: 'Nov 16, 2026 · 2:00 AM · 1.8 GB', ok: true },
  terms: '1. Using STUDIA — provided by OMSU Mamburao Campus for learning and academic activities.',
};
