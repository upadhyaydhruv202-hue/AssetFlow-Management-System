import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, Download, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';
import KPICard from '../Cards/KPICard';
import DataTable, { StatusBadge } from '../Table/DataTable';
import { Button, Input, Select } from '../Forms/FormElements';

const HIGHLIGHT_ROW = {
  red: 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
  orange: 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
  yellow: 'border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20',
  green: 'border-l-4 border-l-green-500',
  gray: 'border-l-4 border-l-gray-400 opacity-70',
};

const PRIORITY_COLORS = {
  CRITICAL: 'text-red-600',
  HIGH: 'text-orange-600',
  MEDIUM: 'text-yellow-600',
  LOW: 'text-green-600',
  RETIRED: 'text-gray-500',
};

export default function MaintenanceRetirementReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '', departmentId: '', categoryId: '', status: '', priority: '', location: '', dateFrom: '', dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('daysRemaining');
  const [sortOrder, setSortOrder] = useState('asc');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/maintenance-retirement', {
      params: { ...filters, page, limit: 10, sortBy, sortOrder },
    }).then(({ data }) => {
      setReport(data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filters, page, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (format) => {
    const token = localStorage.getItem('accessToken');
    const params = new URLSearchParams({ ...filters, type: 'maintenance-retirement', format });
    const res = await fetch(`/api/reports/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-retirement.${format === 'excel' ? 'xlsx' : format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  const summary = report?.summary || {};
  const items = report?.items || [];
  const pagination = report?.pagination || {};

  const columns = [
    { key: 'assetTag', label: 'Asset Tag', render: (r) => <span className="font-medium">{r.assetTag}</span> },
    { key: 'assetName', label: 'Asset Name' },
    { key: 'category', label: 'Category' },
    { key: 'department', label: 'Department' },
    { key: 'assignedEmployee', label: 'Assigned Employee' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'healthScore', label: 'Health', render: (r) => (
      <span className={r.healthScore < 50 ? 'text-red-600 font-medium' : ''}>{r.healthScore}</span>
    )},
    { key: 'lastMaintenanceDate', label: 'Last Maint.', render: (r) => r.lastMaintenanceDate ? format(new Date(r.lastMaintenanceDate), 'MMM d, yyyy') : '—' },
    { key: 'nextMaintenanceDate', label: 'Next Maint.', render: (r) => r.nextMaintenanceDate ? format(new Date(r.nextMaintenanceDate), 'MMM d, yyyy') : '—' },
    { key: 'retirementDate', label: 'Retirement', render: (r) => r.retirementDate ? format(new Date(r.retirementDate), 'MMM d, yyyy') : '—' },
    { key: 'daysRemaining', label: 'Days Left', render: (r) => r.daysRemaining ?? '—' },
    { key: 'priority', label: 'Priority', render: (r) => <span className={`font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span> },
    { key: 'action', label: 'Action', render: (r) => <Link to={`/assets/${r.id}`} className="text-primary-600 hover:underline text-xs">View</Link> },
  ];

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Wrench className="h-5 w-5" /> Assets Due for Maintenance & Near Retirement
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => handleExport('csv')}><Download className="h-3 w-3" /> CSV</Button>
          <Button size="sm" variant="secondary" onClick={() => handleExport('excel')}><Download className="h-3 w-3" /> Excel</Button>
          <Button size="sm" variant="secondary" onClick={() => handleExport('pdf')}><Download className="h-3 w-3" /> PDF</Button>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Due for Maintenance" value={summary.dueForMaintenance || 0} icon={Calendar} color="orange" subtitle="Within 30 days" />
        <KPICard title="Maintenance Overdue" value={summary.maintenanceOverdue || 0} icon={AlertTriangle} color="red" />
        <KPICard title="Near Retirement" value={summary.nearRetirement || 0} icon={Wrench} color="purple" subtitle="Within 90 days" />
        <KPICard title="Retired Assets" value={summary.retiredAssets || 0} icon={Wrench} color="blue" />
      </div>

      <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Input label="Search" placeholder="Tag, name..." value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} />
        <Select label="Department" value={filters.departmentId} onChange={(e) => { setFilters({ ...filters, departmentId: e.target.value }); setPage(1); }}
          options={[{ value: '', label: 'All' }, ...(report?.filters?.departments || []).map((d) => ({ value: d.id, label: d.name }))]} />
        <Select label="Category" value={filters.categoryId} onChange={(e) => { setFilters({ ...filters, categoryId: e.target.value }); setPage(1); }}
          options={[{ value: '', label: 'All' }, ...(report?.filters?.categories || []).map((c) => ({ value: c.id, label: c.name }))]} />
        <Select label="Status" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
          options={[{ value: '', label: 'All' }, { value: 'AVAILABLE', label: 'Available' }, { value: 'ALLOCATED', label: 'Allocated' }, { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' }, { value: 'RETIRED', label: 'Retired' }]} />
        <Select label="Priority" value={filters.priority} onChange={(e) => { setFilters({ ...filters, priority: e.target.value }); setPage(1); }}
          options={[{ value: '', label: 'All' }, { value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />
        <Input label="Location" value={filters.location} onChange={(e) => { setFilters({ ...filters, location: e.target.value }); setPage(1); }} />
        <Input label="From Date" type="date" value={filters.dateFrom} onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1); }} />
      </div>

      <div className="mb-2 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-500" /> Due 30d</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-500" /> Near retirement</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500" /> Healthy</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="cursor-pointer px-3 py-3 font-medium whitespace-nowrap" onClick={() => col.key !== 'action' && handleSort(col.key)}>
                  {col.label}{sortBy === col.key ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">No assets match filters</td></tr>
            ) : items.map((row) => (
              <tr key={row.id} className={`bg-white dark:bg-gray-900 ${HIGHLIGHT_ROW[row.highlight] || ''}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3 whitespace-nowrap">{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} assets)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!pagination.hasPrev} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={!pagination.hasNext} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
