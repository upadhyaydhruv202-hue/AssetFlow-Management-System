import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { PageHeader, Button, Input, Select, Textarea } from '../../components/Forms/FormElements';
import DataTable, { StatusBadge } from '../../components/Table/DataTable';
import Modal from '../../components/Modals/Modal';
import { useAuth } from '../../context/AuthContext';
import { Plus, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

export default function AllocationPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN');
  const canApprove = hasRole('ADMIN');

  const tabs = canManage
    ? [
        { id: 'allocate', label: 'Allocate Asset' },
        { id: 'transfers', label: 'Transfer Requests' },
        { id: 'returns', label: 'Return Assets' },
      ]
    : [
        { id: 'my-assets', label: 'My Assets' },
        { id: 'transfers', label: 'Transfer Requests' },
        { id: 'returns', label: 'Return My Assets' },
      ];

  const [tab, setTab] = useState(tabs[0].id);

  return (
    <div>
      <PageHeader
        title="Asset Allocation & Transfer"
        subtitle={canManage ? 'Manage who holds what with conflict prevention' : 'View your assets, request transfers, and return items'}
      />
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'allocate' && <AllocateTab />}
      {tab === 'my-assets' && <MyAssetsTab />}
      {tab === 'transfers' && <TransfersTab canApprove={canApprove} />}
      {tab === 'returns' && <ReturnsTab employeeOnly={!canManage} />}
    </div>
  );
}

function MyAssetsTab() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/allocations/my').then(({ data }) => {
      setAllocations(data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const columns = [
    { key: 'asset', label: 'Asset', render: (r) => `${r.asset?.assetTag} - ${r.asset?.name}` },
    { key: 'category', label: 'Category', render: (r) => r.asset?.category?.name || '-' },
    { key: 'due', label: 'Expected Return', render: (r) => r.expectedReturnDate ? format(new Date(r.expectedReturnDate), 'MMM d, yyyy') : '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <DataTable columns={columns} data={allocations} loading={loading} emptyMessage="You have no assigned assets" />
  );
}

function AllocateTab() {
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ assetId: '', employeeId: '', departmentId: '', expectedReturnDate: '' });
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/assets?status=AVAILABLE&limit=100'),
      api.get('/employees/all'),
      api.get('/departments/all'),
    ]).then(([a, e, d]) => {
      setAssets(a.data.data);
      setEmployees(e.data.data);
      setDepartments(d.data.data);
    });
  }, []);

  const handleAllocate = async () => {
    try {
      const payload = {
        assetId: form.assetId,
        employeeId: form.employeeId || undefined,
        departmentId: form.departmentId || undefined,
        expectedReturnDate: form.expectedReturnDate || undefined,
      };
      await api.post('/allocations', payload);
      toast.success('Asset allocated');
      setConflict(null);
      setForm({ assetId: '', employeeId: '', departmentId: '', expectedReturnDate: '' });
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data);
        toast.error(err.response.data.message);
      } else {
        toast.error(err.response?.data?.message || 'Error');
      }
    }
  };

  return (
    <div className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <Select label="Asset" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}
        options={[{ value: '', label: 'Select asset' }, ...assets.map((a) => ({ value: a.id, label: `${a.assetTag} - ${a.name}` }))]} />
      <Select label="Employee" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
        options={[{ value: '', label: 'Select employee' }, ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]} />
      <Select label="Department (optional)" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
        options={[{ value: '', label: 'None' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
      <Input label="Expected Return Date" type="date" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} />

      {conflict?.errors?.suggestTransfer && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">{conflict.message}</p>
        </div>
      )}

      <Button onClick={handleAllocate}><Plus className="h-4 w-4" /> Allocate Asset</Button>
    </div>
  );
}

function TransfersTab({ canApprove }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ assetId: '', toEmployeeId: '', reason: '' });

  const load = () => api.get('/transfers').then(({ data }) => { setTransfers(data.data); setLoading(false); });
  useEffect(() => {
    load();
    Promise.all([api.get('/assets?limit=100'), api.get('/employees/all')]).then(([a, e]) => {
      setAssets(a.data.data);
      setEmployees(e.data.data);
    });
  }, []);

  const handleCreate = async () => {
    try {
      const payload = {
        assetId: form.assetId,
        toEmployeeId: form.toEmployeeId || undefined,
        reason: form.reason,
      };
      await api.post('/transfers', payload);
      toast.success('Transfer request created');
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/transfers/${id}/approve`);
      toast.success('Transfer approved');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/transfers/${id}/reject`, { reason: 'Rejected' });
      toast.success('Transfer rejected');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const columns = [
    { key: 'asset', label: 'Asset', render: (r) => r.asset?.assetTag },
    { key: 'from', label: 'From', render: (r) => r.fromEmployee ? `${r.fromEmployee.firstName} ${r.fromEmployee.lastName}` : '-' },
    { key: 'to', label: 'To', render: (r) => r.toEmployee ? `${r.toEmployee.firstName} ${r.toEmployee.lastName}` : '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'date', label: 'Date', render: (r) => format(new Date(r.createdAt), 'MMM d, yyyy') },
    { key: 'actions', label: '', render: (r) => canApprove && r.status === 'REQUESTED' ? (
      <div className="flex gap-1">
        <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>
        <Button size="sm" variant="danger" onClick={() => handleReject(r.id)}>Reject</Button>
      </div>
    ) : null },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> New Transfer</Button></div>
      <DataTable columns={columns} data={transfers} loading={loading} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Transfer Request">
        <div className="space-y-4">
          <Select label="Asset" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...assets.map((a) => ({ value: a.id, label: `${a.assetTag} - ${a.name}` }))]} />
          <Select label="Transfer To" value={form.toEmployeeId} onChange={(e) => setForm({ ...form, toEmployeeId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]} />
          <Textarea label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <Button onClick={handleCreate} className="w-full">Submit Request</Button>
        </div>
      </Modal>
    </>
  );
}

function ReturnsTab({ employeeOnly }) {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState('GOOD');

  const load = () => {
    if (employeeOnly) {
      return api.get('/allocations/my').then(({ data }) => {
        setAllocations(data.data.filter((a) => ['ACTIVE', 'OVERDUE'].includes(a.status)));
        setLoading(false);
      });
    }
    return api.get('/allocations?status=ACTIVE').then(({ data }) => {
      api.get('/allocations?status=OVERDUE').then(({ data: od }) => {
        setAllocations([...data.data, ...od.data]);
        setLoading(false);
      });
    });
  };

  useEffect(() => { load(); }, [employeeOnly]);

  const handleReturn = async () => {
    try {
      await api.post(`/allocations/${modal.id}/return`, { returnNotes: notes, returnCondition: condition });
      toast.success('Asset returned');
      setModal(null);
      setNotes('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error returning asset');
    }
  };

  const columns = [
    { key: 'asset', label: 'Asset', render: (r) => `${r.asset?.assetTag} - ${r.asset?.name}` },
    { key: 'employee', label: 'Holder', render: (r) => r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.department?.name },
    { key: 'due', label: 'Expected Return', render: (r) => r.expectedReturnDate ? format(new Date(r.expectedReturnDate), 'MMM d, yyyy') : '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <Button size="sm" onClick={() => setModal(r)}>Return</Button>
    )},
  ];

  return (
    <>
      <DataTable columns={columns} data={allocations} loading={loading} emptyMessage={employeeOnly ? 'You have no assets to return' : 'No active allocations'} />
      <Modal isOpen={!!modal} onClose={() => setModal(null)} title="Return Asset">
        <div className="space-y-4">
          <Textarea label="Check-in Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Select label="Condition on Return" value={condition} onChange={(e) => setCondition(e.target.value)}
            options={['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'].map((c) => ({ value: c, label: c }))} />
          <Button onClick={handleReturn} className="w-full">Confirm Return</Button>
        </div>
      </Modal>
    </>
  );
}
