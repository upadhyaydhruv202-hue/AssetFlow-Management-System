import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Users, Wrench, Calendar, ArrowLeftRight, Clock, AlertTriangle, Plus, RefreshCw, BarChart3, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import KPICard from '../../components/Cards/KPICard';
import { PageHeader, Button } from '../../components/Forms/FormElements';
import { StatusBadge } from '../../components/Table/DataTable';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import usePolling from '../../hooks/usePolling';
import AiSummary from '../../components/Dashboard/AiSummary';
import CriticalAlerts from '../../components/Dashboard/CriticalAlerts';
import AssetHealthWidget from '../../components/Dashboard/AssetHealthWidget';
import Recommendations from '../../components/Dashboard/Recommendations';

export default function Dashboard() {
  const { hasRole, user } = useAuth();
  const isEmployee = !hasRole('ADMIN');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(() => {
    api.get('/dashboard').then(({ data: res }) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  usePolling(fetchDashboard, 30000);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  }

  const kpis = data?.kpis || {};
  const roleLabel = kpis.roleLabel || 'Dashboard';

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Link to="/assets/add"><Button size="sm"><Plus className="h-4 w-4" /> Register Asset</Button></Link>
      <Link to="/bookings"><Button size="sm" variant="secondary"><Calendar className="h-4 w-4" /> Book Resource</Button></Link>
      <Link to="/maintenance"><Button size="sm" variant="secondary"><Wrench className="h-4 w-4" /> Maintenance</Button></Link>
      {!isEmployee && (
        <Link to="/allocation"><Button size="sm" variant="secondary"><ArrowLeftRight className="h-4 w-4" /> Allocate Asset</Button></Link>
      )}
    </div>
  );

  const kpiCards = isEmployee ? (
    <>
      <KPICard title="My Assets" value={kpis.assetsAllocated || 0} icon={Package} color="blue" />
      <KPICard title="My Bookings" value={kpis.activeBookings || 0} icon={Calendar} color="purple" />
      <KPICard title="My Maintenance" value={kpis.maintenanceToday || 0} icon={Wrench} color="orange" />
      <KPICard title="My Transfers" value={kpis.pendingTransfers || 0} icon={ArrowLeftRight} color="primary" />
      <KPICard title="Upcoming Returns" value={kpis.upcomingReturns || 0} icon={Clock} color="blue" />
      <KPICard title="Overdue" value={kpis.overdueCount || 0} icon={AlertTriangle} color="green" />
    </>
  ) : (
    <>
      <KPICard title="Available" value={kpis.assetsAvailable || 0} icon={Package} color="green" />
      <KPICard title="Allocated" value={kpis.assetsAllocated || 0} icon={Users} color="blue" />
      <KPICard title="Maintenance Today" value={kpis.maintenanceToday || 0} icon={Wrench} color="orange" />
      <KPICard title="Active Bookings" value={kpis.activeBookings || 0} icon={Calendar} color="purple" />
      <KPICard title="Pending Transfers" value={kpis.pendingTransfers || 0} icon={ArrowLeftRight} color="primary" />
      <KPICard title="Upcoming Returns" value={kpis.upcomingReturns || 0} icon={Clock} color="blue" />
    </>
  );

  const quickActions = isEmployee ? (
    <>
      <Link to="/assets/add" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <Package className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Register Asset</p>
      </Link>
      <Link to="/bookings" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <Calendar className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Book Resource</p>
      </Link>
      <Link to="/allocation" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <ArrowLeftRight className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Transfer / Return</p>
      </Link>
      <Link to="/maintenance" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <Wrench className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Raise Maintenance</p>
      </Link>
    </>
  ) : (
    <>
      <Link to="/assets/add" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <Package className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Register Asset</p>
      </Link>
      <Link to="/bookings" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <Calendar className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Book Resource</p>
      </Link>
      <Link to="/allocation" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <ArrowLeftRight className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Allocate Asset</p>
      </Link>
      <Link to="/maintenance" className="rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <Wrench className="mx-auto h-6 w-6 text-primary-600" />
        <p className="mt-2 text-sm font-medium">Raise Maintenance</p>
      </Link>
    </>
  );

  return (
    <div>
      <PageHeader
        title={`${roleLabel} Dashboard`}
        subtitle={kpis.focus || (isEmployee ? 'Your personal workspace overview' : 'Real-time operational snapshot')}
        action={(
          <div className="flex flex-wrap gap-2">
            {headerActions}
            <Button size="sm" variant="ghost" onClick={fetchDashboard}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        )}
      />

      <div className="mb-6 space-y-4">
        <CriticalAlerts alerts={data?.criticalAlerts} />
        <AiSummary summary={data?.aiSummary} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards}
      </div>

      {!isEmployee && data?.maintenanceSummary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Due for Maintenance" value={data.maintenanceSummary.dueForMaintenance || 0} icon={Wrench} color="orange" subtitle="Within 30 days" />
          <KPICard title="Maintenance Overdue" value={data.maintenanceSummary.maintenanceOverdue || 0} icon={AlertTriangle} color="red" />
          <KPICard title="Near Retirement" value={data.maintenanceSummary.nearRetirement || 0} icon={Clock} color="purple" />
          <KPICard title="Avg Health Score" value={data.maintenanceSummary.averageHealthScore || 0} icon={Package} color="green" />
        </div>
      )}

      {!isEmployee && data?.peakUsage && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard title="Most Booked Resource" value={data.peakUsage.mostBookedResource?.name?.slice(0, 20) || '—'} icon={TrendingUp} color="red" subtitle={`${data.peakUsage.mostBookedResource?.totalBookings || 0} bookings`} />
          <KPICard title="Lowest Utilized" value={data.peakUsage.leastUsedResource?.name?.slice(0, 20) || '—'} icon={BarChart3} color="green" />
          <KPICard title="Peak Booking Hour" value={data.peakUsage.peakBookingHour?.label || '—'} icon={Calendar} color="orange" subtitle={`${data.peakUsage.resourceUtilizationPct || 0}% avg utilization`} />
        </div>
      )}

      {data?.overdueReturns?.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold">
              {isEmployee ? 'My Overdue Returns' : 'Overdue Returns'} ({data.overdueReturns.length})
            </h3>
          </div>
          <div className="space-y-2">
            {data.overdueReturns.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-white p-3 dark:bg-gray-900">
                <div>
                  <span className="font-medium">{a.asset?.assetTag}</span> - {a.asset?.name}
                  {!isEmployee && a.employee && (
                    <span className="ml-2 text-sm text-gray-500">held by {a.employee.firstName} {a.employee.lastName}</span>
                  )}
                </div>
                <div className="text-sm text-red-600">
                  Due: {a.expectedReturnDate ? format(new Date(a.expectedReturnDate), 'MMM d, yyyy') : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 font-semibold">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions}
          </div>
        </div>

        <Recommendations items={data?.recommendations} />
        <AssetHealthWidget assets={data?.assetHealth} />
      </div>

      {data?.refreshedAt && (
        <p className="mt-4 text-center text-xs text-gray-400">Last updated: {format(new Date(data.refreshedAt), 'HH:mm:ss')} · Auto-refreshes every 30s</p>
      )}
    </div>
  );
}
