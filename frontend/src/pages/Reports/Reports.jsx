import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import { PageHeader, Button } from '../../components/Forms/FormElements';
import { Download } from 'lucide-react';
import MaintenanceRetirementReport from '../../components/Reports/MaintenanceRetirementReport';
import BookingHeatmapReport from '../../components/Reports/BookingHeatmapReport';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Reports() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [benchmark, setBenchmark] = useState(null);
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports'),
      api.get('/reports/insights'),
      api.get('/reports/forecast'),
      api.get('/reports/benchmark'),
      api.get('/reports/cost-prediction'),
    ]).then(([r, i, f, b, c]) => {
      setData(r.data.data);
      setInsights(i.data.data);
      setForecast(f.data.data);
      setBenchmark(b.data.data);
      setCosts(c.data.data);
      setLoading(false);
    });
  }, []);

  const handleExport = (type) => {
    window.open(`/api/reports/export?type=${type}`, '_blank');
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;

  const topUtilized = (data?.utilization || []).slice(0, 10);
  const deptSummary = data?.departmentSummary || [];
  const categoryMaint = data?.categoryMaintenance || [];

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="AI-powered operational insights and exportable reports"
        action={<Button variant="secondary" onClick={() => handleExport('utilization')}><Download className="h-4 w-4" /> Export</Button>} />

      {insights && (
        <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
          <h3 className="font-semibold">AI Business Insights</h3>
          <p className="mt-2 text-sm">{insights.summary}</p>
          <ul className="mt-2 space-y-1 text-sm">{insights.insights?.map((i, idx) => <li key={idx}>• {i}</li>)}</ul>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {forecast && (
          <div className="rounded-xl border p-4 dark:border-gray-800">
            <h4 className="font-medium">Booking Forecast</h4>
            <p className="text-2xl font-bold text-primary-600">{forecast.bookingForecast?.nextMonth}</p>
            <p className="text-xs text-gray-500">next month ({forecast.bookingForecast?.trend})</p>
          </div>
        )}
        {costs && (
          <div className="rounded-xl border p-4 dark:border-gray-800">
            <h4 className="font-medium">Maintenance Cost (Q)</h4>
            <p className="text-2xl font-bold text-orange-600">${costs.maintenanceCostNextQuarter?.toLocaleString()}</p>
          </div>
        )}
        {benchmark?.[0] && (
          <div className="rounded-xl border p-4 dark:border-gray-800">
            <h4 className="font-medium">Top Department</h4>
            <p className="text-lg font-bold">{benchmark[0].name}</p>
            <p className="text-xs text-gray-500">Score: {benchmark[0].score}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 font-semibold">Asset Utilization (Top 10)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topUtilized}>
              <XAxis dataKey="assetTag" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="utilizationScore" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 font-semibold">Maintenance by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={categoryMaint} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                {categoryMaint.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 font-semibold">Department Allocation Summary</h3>
          <div className="space-y-3">
            {deptSummary.map((d) => (
              <div key={d.id} className="flex items-center justify-between">
                <span>{d.name}</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-500">{d.employeeCount} employees</span>
                  <span className="font-medium">{d.activeAllocations} allocations</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 font-semibold">Assets Due for Maintenance (Quick View)</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {(data?.assetsDueMaintenance || []).map((a) => (
              <div key={a.id} className="flex justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <span>{a.assetTag} - {a.name}</span>
                <span className="text-sm text-orange-600">{a.status?.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {!data?.assetsDueMaintenance?.length && <p className="text-gray-500">No assets due</p>}
          </div>
        </div>
      </div>

      <MaintenanceRetirementReport />
      <BookingHeatmapReport />
    </div>
  );
}
