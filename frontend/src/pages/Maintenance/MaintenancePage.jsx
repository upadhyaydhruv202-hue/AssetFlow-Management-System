import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft, Plus } from 'lucide-react';
import api from '../../services/api';
import { PageHeader, Button, Input, Select, Textarea } from '../../components/Forms/FormElements';
import DataTable, { StatusBadge } from '../../components/Table/DataTable';
import Modal from '../../components/Modals/Modal';
import { useAuth } from '../../context/AuthContext';

export default function MaintenancePage() {
  const { id } = useParams();
  if (id) return <MaintenanceDetails id={id} />;
  return <MaintenanceList />;
}

function MaintenanceList() {
  const { hasRole } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ assetId: '', title: '', description: '', priority: 'MEDIUM' });
  const [photo, setPhoto] = useState(null);

  const load = () => api.get('/maintenance').then(({ data }) => { setRequests(data.data); setLoading(false); });
  useEffect(() => {
    load();
    api.get('/assets?limit=100').then(({ data }) => setAssets(data.data));
  }, []);

  const handleCreate = async () => {
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photo) fd.append('photo', photo);
      await api.post('/maintenance', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Maintenance request raised');
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleAction = async (id, action, data = {}) => {
    await api.post(`/maintenance/${id}/${action}`, data);
    toast.success(`Request ${action}d`);
    load();
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r) => <Link to={`/maintenance/${r.id}`} className="text-primary-600 hover:underline">{r.title}</Link> },
    { key: 'asset', label: 'Asset', render: (r) => r.asset?.assetTag },
    { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'requester', label: 'Requested By', render: (r) => `${r.requestedBy?.firstName} ${r.requestedBy?.lastName}` },
    { key: 'date', label: 'Date', render: (r) => format(new Date(r.createdAt), 'MMM d, yyyy') },
    { key: 'actions', label: '', render: (r) => {
      if (!hasRole('ADMIN')) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {r.status === 'PENDING' && <>
            <Button size="sm" onClick={() => handleAction(r.id, 'approve')}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => handleAction(r.id, 'reject')}>Reject</Button>
          </>}
          {r.status === 'APPROVED' && <Button size="sm" onClick={() => handleAction(r.id, 'start')}>Start</Button>}
          {['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(r.status) && (
            <Button size="sm" variant="success" onClick={() => handleAction(r.id, 'resolve', { resolutionNotes: 'Resolved' })}>Resolve</Button>
          )}
        </div>
      );
    }},
  ];

  return (
    <div>
      <PageHeader
        title={hasRole('ADMIN') ? 'Maintenance Management' : 'My Maintenance Requests'}
        subtitle={hasRole('ADMIN') ? 'Route repairs through approval workflow' : 'Track and raise maintenance for your assets'}
        action={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Raise Request</Button>}
      />
      <DataTable columns={columns} data={requests} loading={loading} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Raise Maintenance Request">
        <div className="space-y-4">
          <Select label="Asset" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...assets.map((a) => ({ value: a.id, label: `${a.assetTag} - ${a.name}` }))]} />
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => ({ value: p, label: p }))} />
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} className="text-sm" />
          <Button onClick={handleCreate} className="w-full">Submit Request</Button>
        </div>
      </Modal>
    </div>
  );
}

function MaintenanceDetails({ id }) {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    api.get(`/maintenance/${id}`).then(({ data }) => setRequest(data.data));
  }, [id]);

  if (!request) return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;

  return (
    <div>
      <Link to="/maintenance" className="mb-4 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title={request.title} action={<StatusBadge status={request.status} />} />
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-gray-500">Asset</dt><dd>{request.asset?.assetTag} - {request.asset?.name}</dd></div>
          <div><dt className="text-gray-500">Priority</dt><dd><StatusBadge status={request.priority} /></dd></div>
          <div><dt className="text-gray-500">Requested By</dt><dd>{request.requestedBy?.firstName} {request.requestedBy?.lastName}</dd></div>
          <div><dt className="text-gray-500">Technician</dt><dd>{request.technician ? `${request.technician.firstName} ${request.technician.lastName}` : '-'}</dd></div>
        </dl>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{request.description}</p>
        {request.resolutionNotes && <p className="mt-2 text-sm"><strong>Resolution:</strong> {request.resolutionNotes}</p>}
      </div>
    </div>
  );
}
