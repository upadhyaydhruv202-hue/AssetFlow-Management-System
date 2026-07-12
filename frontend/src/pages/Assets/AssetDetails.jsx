import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { PageHeader, Button } from '../../components/Forms/FormElements';
import { StatusBadge } from '../../components/Table/DataTable';
import DataTable from '../../components/Table/DataTable';

export default function AssetDetails() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [twin, setTwin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/assets/${id}`),
      api.get(`/assets/${id}/twin`),
    ]).then(([assetRes, twinRes]) => {
      setAsset(assetRes.data.data);
      setTwin(twinRes.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  if (!asset) return <p>Asset not found</p>;

  const allocColumns = [
    { key: 'date', label: 'Date', render: (r) => format(new Date(r.createdAt), 'MMM d, yyyy') },
    { key: 'employee', label: 'Employee', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '-' },
    { key: 'department', label: 'Department', render: (r) => r.department?.name || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'return', label: 'Return Date', render: (r) => r.actualReturnDate ? format(new Date(r.actualReturnDate), 'MMM d, yyyy') : r.expectedReturnDate ? format(new Date(r.expectedReturnDate), 'MMM d, yyyy') : '-' },
  ];

  const maintColumns = [
    { key: 'title', label: 'Title' },
    { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'date', label: 'Date', render: (r) => format(new Date(r.createdAt), 'MMM d, yyyy') },
  ];

  return (
    <div>
      <Link to="/assets" className="mb-4 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Assets
      </Link>
      <PageHeader title={`${asset.assetTag} - ${asset.name}`} subtitle={asset.category?.name}
        action={<StatusBadge status={asset.status} />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="mb-4 font-semibold">Asset Details</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Serial Number</dt><dd className="font-medium">{asset.serialNumber || '-'}</dd></div>
              <div><dt className="text-gray-500">Location</dt><dd className="font-medium">{asset.location || '-'}</dd></div>
              <div><dt className="text-gray-500">Condition</dt><dd><StatusBadge status={asset.condition} /></dd></div>
              <div><dt className="text-gray-500">Health Score</dt><dd className="font-bold text-primary-600">{twin?.profile?.healthScore ?? asset.healthScore ?? 100}%</dd></div>
              <div><dt className="text-gray-500">RFID</dt><dd className="font-medium">{asset.rfidIdentifier || '-'}</dd></div>
              <div><dt className="text-gray-500">Acquisition Date</dt><dd>{asset.acquisitionDate ? format(new Date(asset.acquisitionDate), 'MMM d, yyyy') : '-'}</dd></div>
              <div><dt className="text-gray-500">Acquisition Cost</dt><dd>{asset.acquisitionCost ? `$${Number(asset.acquisitionCost).toLocaleString()}` : '-'}</dd></div>
              <div><dt className="text-gray-500">Bookable</dt><dd>{asset.isBookable ? 'Yes' : 'No'}</dd></div>
            </dl>
            {asset.description && <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{asset.description}</p>}
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Digital Twin Timeline</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              {(twin?.timeline || []).slice(0, 15).map((e, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2 dark:border-gray-700">
                  <span>{e.action || e.type}</span>
                  <span className="text-gray-500">{format(new Date(e.date), 'MMM d, yyyy')}</span>
                </div>
              ))}
              {!twin?.timeline?.length && <p className="text-sm text-gray-500">No timeline events yet</p>}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Allocation History</h3>
            <DataTable columns={allocColumns} data={asset.allocations || []} emptyMessage="No allocation history" />
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Maintenance History</h3>
            <DataTable columns={maintColumns} data={asset.maintenanceRequests || []} emptyMessage="No maintenance history" />
          </div>
        </div>

        <div>
          {asset.qrCode && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold">QR Code</h3>
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg bg-gray-100 font-mono text-xs dark:bg-gray-800">{asset.assetTag}</div>
            </div>
          )}
          {asset.photoUrl && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <img src={asset.photoUrl} alt={asset.name} className="rounded-lg w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
