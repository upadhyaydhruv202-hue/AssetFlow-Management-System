import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Calendar, Download, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import KPICard from '../Cards/KPICard';
import { Button, Input, Select } from '../Forms/FormElements';

const INTENSITY_COLORS = {
  low: 'bg-green-200 dark:bg-green-900/50',
  medium: 'bg-yellow-300 dark:bg-yellow-800/50',
  high: 'bg-orange-400 dark:bg-orange-700/60',
  peak: 'bg-red-500 dark:bg-red-700/70 text-white',
};

export default function BookingHeatmapReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '', dateTo: '', departmentId: '', categoryId: '', location: '', building: '', floor: '',
  });
  const [tooltip, setTooltip] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/booking-heatmap', { params: filters })
      .then(({ data: res }) => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (format) => {
    const token = localStorage.getItem('accessToken');
    const params = new URLSearchParams({ ...filters, type: 'booking-heatmap', format });
    const res = await fetch(`/api/reports/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-heatmap.${format === 'excel' ? 'xlsx' : format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = data?.summary || {};
  const timeSlots = data?.timeSlots || [];
  const resources = data?.resources || [];

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="h-5 w-5" /> Resource Booking Heatmap
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => handleExport('csv')}><Download className="h-3 w-3" /> CSV</Button>
          <Button size="sm" variant="secondary" onClick={() => handleExport('excel')}><Download className="h-3 w-3" /> Excel</Button>
          <Button size="sm" variant="secondary" onClick={() => handleExport('pdf')}><Download className="h-3 w-3" /> PDF</Button>
        </div>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard title="Most Booked" value={summary.mostBookedResource?.name?.slice(0, 18) || '—'} icon={TrendingUp} color="red" subtitle={`${summary.mostBookedResource?.totalBookings || 0} bookings`} />
        <KPICard title="Least Used" value={summary.leastUsedResource?.name?.slice(0, 18) || '—'} icon={BarChart3} color="green" subtitle={`${summary.leastUsedResource?.totalBookings || 0} bookings`} />
        <KPICard title="Peak Hour" value={summary.peakBookingHour?.label || '—'} icon={Calendar} color="orange" subtitle={`${summary.peakBookingHour?.count || 0} bookings`} />
        <KPICard title="Avg Daily Bookings" value={summary.averageDailyBookings || 0} icon={Calendar} color="blue" />
        <KPICard title="Utilization" value={`${summary.resourceUtilizationPct || 0}%`} icon={TrendingUp} color="purple" />
      </div>

      <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Input label="From" type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
        <Input label="To" type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        <Select label="Department" value={filters.departmentId} onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
          options={[{ value: '', label: 'All' }, ...(data?.filters?.departments || []).map((d) => ({ value: d.id, label: d.name }))]} />
        <Select label="Resource Type" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          options={[{ value: '', label: 'All' }, ...(data?.filters?.categories || []).map((c) => ({ value: c.id, label: c.name }))]} />
        <Input label="Building" value={filters.building} onChange={(e) => setFilters({ ...filters, building: e.target.value })} placeholder="Building B" />
        <Input label="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
      </div>

      <div className="mb-2 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="h-3 w-6 rounded bg-green-200" /> Low</span>
        <span className="flex items-center gap-1"><span className="h-3 w-6 rounded bg-yellow-300" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-3 w-6 rounded bg-orange-400" /> High</span>
        <span className="flex items-center gap-1"><span className="h-3 w-6 rounded bg-red-500" /> Peak</span>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>
      ) : resources.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-gray-500 dark:border-gray-800">No bookable resources found for the selected filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-2 py-2 text-left font-medium dark:bg-gray-900">Resource</th>
                {timeSlots.map((slot) => (
                  <th key={slot.hour} className="px-1 py-2 text-center font-medium whitespace-nowrap">{slot.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="sticky left-0 bg-white px-2 py-2 font-medium dark:bg-gray-900">
                    <div>{resource.name}</div>
                    <div className="text-gray-500">{resource.category}</div>
                  </td>
                  {resource.cells.map((cell) => (
                    <td key={cell.hour} className="p-0.5">
                      <div
                        className={`flex h-10 cursor-pointer items-center justify-center rounded text-xs font-medium transition hover:ring-2 hover:ring-primary-400 ${INTENSITY_COLORS[cell.intensity]}`}
                        onMouseEnter={() => setTooltip({ resource: resource.name, ...cell })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {cell.count || ''}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tooltip && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="font-semibold">{tooltip.resource}</p>
          <p className="text-sm text-gray-500">{tooltip.label}</p>
          <p className="mt-1 text-sm">Bookings: <strong>{tooltip.count}</strong></p>
          <p className="text-sm">Utilization: <strong>{tooltip.utilizationPct}%</strong></p>
          <p className="text-sm">Peak day: <strong>{tooltip.peakDay}</strong></p>
        </div>
      )}
    </div>
  );
}
