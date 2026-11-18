import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import Layout from './shared/components/Layout';
import Login from './features/auth/pages/Login';
import Home from './features/dashboard/pages/Home';
import Users from './features/users/pages/Users';
import Settings from './features/settings/pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      {/* There is no register route — the admin account is fixed. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
