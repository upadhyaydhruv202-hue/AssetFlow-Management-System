import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ArrowLeft, Plus } from 'lucide-react';
import api from '../../services/api';
import { PageHeader, Button, Input, Select, Textarea } from '../../components/Forms/FormElements';
import DataTable, { StatusBadge } from '../../components/Table/DataTable';
import Modal from '../../components/Modals/Modal';

export default function AuditPage() {
  const { id } = useParams();
  if (id) return <AuditDetails id={id} />;
  return <AuditList />;
}

function AuditList() {
  const [cycles, setCycles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', scope: '', location: '', departmentId: '', startDate: '', endDate: '', auditorIds: [] });

  const load = () => api.get('/audits').then(({ data }) => { setCycles(data.data); setLoading(false); });
  useEffect(() => {
    load();
    Promise.all([api.get('/departments/all'), api.get('/employees/all')]).then(([d, e]) => {
      setDepartments(d.data.data);
      setEmployees(e.data.data);
    });
  }, []);

  const handleCreate = async () => {
    try {
      await api.post('/audits', { ...form, auditorIds: form.auditorIds.length ? form.auditorIds : undefined });
      toast.success('Audit cycle created');
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const columns = [
    { key: 'name', label: 'Cycle', render: (r) => <Link to={`/audit/${r.id}`} className="text-primary-600 hover:underline">{r.name}</Link> },
    { key: 'scope', label: 'Scope', render: (r) => r.scope || r.department?.name || r.location || '-' },
    { key: 'dates', label: 'Period', render: (r) => `${format(new Date(r.startDate), 'MMM d')} - ${format(new Date(r.endDate), 'MMM d, yyyy')}` },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'items', label: 'Items', render: (r) => r._count?.items || 0 },
    { key: 'auditors', label: 'Auditors', render: (r) => r.assignments?.map((a) => a.auditor?.firstName).join(', ') || '-' },
  ];

  return (
    <div>
      <PageHeader title="Asset Audit" subtitle="Structured verification cycles with discrepancy reports"
        action={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> New Audit Cycle</Button>} />
      <DataTable columns={columns} data={cycles} loading={loading} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Create Audit Cycle" size="lg">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Scope" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
          <Select label="Department" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            options={[{ value: '', label: 'All' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <Select label="Auditor" value={form.auditorIds[0] || ''} onChange={(e) => setForm({ ...form, auditorIds: e.target.value ? [e.target.value] : [] })}
            options={[{ value: '', label: 'Select auditor' }, ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]} />
          <Button onClick={handleCreate} className="w-full">Create Cycle</Button>
        </div>
      </Modal>
    </div>
  );
}

function AuditDetails({ id }) {
  const [cycle, setCycle] = useState(null);
  const [discrepancies, setDiscrepancies] = useState(null);

  const load = () => {
    api.get(`/audits/${id}`).then(({ data }) => setCycle(data.data));
    api.get(`/audits/${id}/discrepancies`).then(({ data }) => setDiscrepancies(data.data));
  };

  useEffect(() => { load(); }, [id]);

  const handleStart = async () => {
    await api.post(`/audits/${id}/start`);
    toast.success('Audit started');
    load();
  };

  const handleClose = async () => {
    await api.post(`/audits/${id}/close`);
    toast.success('Audit cycle closed');
    load();
  };

  const handleVerify = async (itemId, status) => {
    await api.patch(`/audits/${id}/items/${itemId}`, { status });
    toast.success('Item updated');
    load();
  };

  if (!cycle) return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;

  const itemColumns = [
    { key: 'asset', label: 'Asset', render: (r) => `${r.asset?.assetTag} - ${r.asset?.name}` },
    { key: 'category', label: 'Category', render: (r) => r.asset?.category?.name },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => cycle.status === 'IN_PROGRESS' && r.status === 'PENDING' ? (
      <div className="flex gap-1">
        <Button size="sm" onClick={() => handleVerify(r.id, 'VERIFIED')}>Verified</Button>
        <Button size="sm" variant="danger" onClick={() => handleVerify(r.id, 'MISSING')}>Missing</Button>
        <Button size="sm" variant="secondary" onClick={() => handleVerify(r.id, 'DAMAGED')}>Damaged</Button>
      </div>
    ) : null },
  ];

  return (
    <div>
      <Link to="/audit" className="mb-4 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title={cycle.name} action={
        <div className="flex gap-2">
          <StatusBadge status={cycle.status} />
          {cycle.status === 'DRAFT' && <Button onClick={handleStart}>Start Audit</Button>}
          {cycle.status === 'IN_PROGRESS' && <Button variant="success" onClick={handleClose}>Close Cycle</Button>}
        </div>
      } />

      {discrepancies?.count > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
          <h3 className="font-semibold text-red-700 dark:text-red-400">Discrepancy Report ({discrepancies.count})</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {discrepancies.items?.map((i) => (
              <li key={i.id}>{i.asset?.assetTag} - <StatusBadge status={i.status} /></li>
            ))}
          </ul>
        </div>
      )}

      <DataTable columns={itemColumns} data={cycle.items || []} emptyMessage="No audit items. Start the cycle to generate items." />
    </div>
  );
}
