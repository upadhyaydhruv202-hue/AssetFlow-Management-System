import { Routes, Route, Navigate } from 'react-router-dom';
import Layout, { ProtectedRoute } from './components/Layout/Layout';
import Login from './pages/Login/Login';
import MagicLogin from './pages/Login/MagicLogin';
import ResetPassword from './pages/Login/ResetPassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Organization from './pages/Organization/Organization';
import AssetList from './pages/Assets/AssetList';
import AddAsset from './pages/Assets/AddAsset';
import AssetDetails from './pages/Assets/AssetDetails';
import AllocationPage from './pages/Allocation/AllocationPage';
import BookingsPage from './pages/Bookings/BookingsPage';
import MaintenancePage from './pages/Maintenance/MaintenancePage';
import AuditPage from './pages/Audit/AuditPage';
import Reports from './pages/Reports/Reports';
import Notifications from './pages/Notifications/Notifications';
import ActivityLogs from './pages/Activity/ActivityLogs';
import SecuritySettings from './pages/Profile/SecuritySettings';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/magic-login" element={<MagicLogin />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="organization" element={
          <ProtectedRoute roles={['ADMIN']}><Organization /></ProtectedRoute>
        } />
        <Route path="assets" element={<AssetList />} />
        <Route path="assets/add" element={<AddAsset />} />
        <Route path="assets/:id" element={<AssetDetails />} />
        <Route path="allocation" element={<AllocationPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="maintenance/:id" element={<MaintenancePage />} />
        <Route path="audit" element={
          <ProtectedRoute roles={['ADMIN']}><AuditPage /></ProtectedRoute>
        } />
        <Route path="audit/:id" element={
          <ProtectedRoute roles={['ADMIN']}><AuditPage /></ProtectedRoute>
        } />
        <Route path="reports" element={
          <ProtectedRoute roles={['ADMIN']}><Reports /></ProtectedRoute>
        } />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity" element={
          <ProtectedRoute roles={['ADMIN']}><ActivityLogs /></ProtectedRoute>
        } />
        <Route path="profile/security" element={<SecuritySettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
