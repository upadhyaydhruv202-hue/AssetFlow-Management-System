import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Package, ArrowLeftRight, Calendar,
  Wrench, ClipboardCheck, BarChart3, Bell, Activity, Users, Tags, LogOut, Boxes, Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: null },
  { to: '/organization', icon: Building2, label: 'Organization', roles: ['ADMIN'] },
  { to: '/assets', icon: Package, label: 'Assets', roles: null },
  { to: '/allocation', icon: ArrowLeftRight, label: 'Allocation', roles: null },
  { to: '/bookings', icon: Calendar, label: 'Bookings', roles: null },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance', roles: null },
  { to: '/audit', icon: ClipboardCheck, label: 'Audit', roles: ['ADMIN'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['ADMIN'] },
  { to: '/notifications', icon: Bell, label: 'Notifications', roles: null },
  { to: '/profile/security', icon: Shield, label: 'Security', roles: null },
  { to: '/activity', icon: Activity, label: 'Activity Logs', roles: ['ADMIN'] },
];

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth();

  const filtered = navItems.filter(
    (item) => !item.roles || hasRole(...item.roles)
  );

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6 dark:border-gray-800">
        <Boxes className="h-8 w-8 text-primary-600" />
        <div>
          <h1 className="text-lg font-bold text-primary-700 dark:text-primary-400">AssetFlow</h1>
          <p className="text-xs text-gray-500">Enterprise ERP</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {filtered.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          <p className="text-sm font-medium">{user?.employee?.firstName} {user?.employee?.lastName}</p>
          <p className="text-xs text-gray-500">{user?.role?.replace(/_/g, ' ')}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </aside>
  );
}

export { Users, Tags };
