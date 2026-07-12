import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { PageHeader, Button, Input, Select, Textarea } from '../../components/Forms/FormElements';
import DataTable, { StatusBadge } from '../../components/Table/DataTable';
import Modal from '../../components/Modals/Modal';
import { Plus, Pencil } from 'lucide-react';

export default function Organization() {
  const [tab, setTab] = useState('departments');
  const tabs = [
    { id: 'departments', label: 'Departments' },
    { id: 'categories', label: 'Asset Categories' },
    { id: 'employees', label: 'Employee Directory' },
    { id: 'tree', label: 'Org Tree' },
    { id: 'import', label: 'Bulk Import' },
    { id: 'approval', label: 'Approval Matrix' },
  ];

  return (
    <div>
      <PageHeader title="Organization Setup" subtitle="Manage master data for your organization" />
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'tree' && <OrgTreeTab />}
      {tab === 'import' && <BulkImportTab />}
      {tab === 'approval' && <ApprovalMatrixTab />}
    </div>
  );
}

function OrgTreeTab() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const loadTree = useCallback(async () => {
    const { data } = await api.get('/organization/tree');
    setTree(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const collectDescendantIds = (node) => {
    const ids = new Set();
    const walk = (n) => {
      n.children?.forEach((child) => {
        ids.add(child.id);
        walk(child);
      });
    };
    walk(node);
    return ids;
  };

  const findNode = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children || [], id);
      if (found) return found;
    }
    return null;
  };

  const moveDepartment = async (sourceId, parentId) => {
    if (!sourceId || sourceId === parentId) return;

    const sourceNode = findNode(tree, sourceId);
    if (sourceNode && parentId) {
      const descendants = collectDescendantIds(sourceNode);
      if (descendants.has(parentId)) {
        toast.error('Cannot move a department under its own descendant');
        return;
      }
    }

    setMoving(true);
    try {
      await api.patch(`/organization/departments/${sourceId}/move`, { parentId: parentId || null });
      toast.success(parentId ? 'Department moved' : 'Department moved to top level');
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to move department');
    } finally {
      setMoving(false);
      setDragId(null);
      setDropTargetId(null);
    }
  };

  const handleDragStart = (e, nodeId) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(nodeId);
  };

  const handleDragOver = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragId && dragId !== nodeId) setDropTargetId(nodeId);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain') || dragId;
    moveDepartment(sourceId, targetId);
  };

  const renderNode = (node, depth = 0) => {
    const isDropTarget = dropTargetId === node.id && dragId && dragId !== node.id;
    return (
      <div key={node.id} className="mb-2">
        <div
          draggable={!moving}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragEnd={() => { setDragId(null); setDropTargetId(null); }}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={() => setDropTargetId((prev) => (prev === node.id ? null : prev))}
          onDrop={(e) => handleDrop(e, node.id)}
          style={{ marginLeft: depth * 20 }}
          className={`cursor-move rounded-lg border p-3 transition-colors ${
            isDropTarget
              ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/40'
              : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
          } ${dragId === node.id ? 'opacity-50' : ''}`}
        >
          <span className="font-medium">{node.name}</span>
          <span className="ml-2 text-xs text-gray-500">({node.code}) · {node._count?.employees || 0} employees</span>
        </div>
        {node.children?.length > 0 && (
          <div className="mt-2 border-l border-dashed border-gray-200 pl-2 dark:border-gray-700">
            {node.children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Drag a department onto another to reparent it, or drop on the zone below to move it to the top level.</p>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetId('root'); }}
        onDragLeave={() => setDropTargetId((prev) => (prev === 'root' ? null : prev))}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData('text/plain') || dragId;
          moveDepartment(sourceId, null);
        }}
        className={`rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
          dropTargetId === 'root'
            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-300'
            : 'border-gray-300 text-gray-500 dark:border-gray-600'
        }`}
      >
        Drop here to move to top level
      </div>
      <div className={`rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 ${moving ? 'pointer-events-none opacity-60' : ''}`}>
        {tree.length === 0 ? (
          <p className="text-sm text-gray-500">No departments found.</p>
        ) : (
          tree.map((n) => renderNode(n))
        )}
      </div>
    </div>
  );
}

function BulkImportTab() {
  const [entityType, setEntityType] = useState('EMPLOYEES');
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    const { data } = await api.post('/organization/import', { entityType, csvContent: csv });
    setResult(data.data);
    toast.success(`Imported ${data.data.successCount} rows`);
  };

  return (
    <div className="space-y-4">
      <Select label="Entity Type" value={entityType} onChange={(e) => setEntityType(e.target.value)}
        options={[
          { value: 'EMPLOYEES', label: 'Employees' },
          { value: 'DEPARTMENTS', label: 'Departments' },
          { value: 'CATEGORIES', label: 'Categories' },
          { value: 'ASSETS', label: 'Assets' },
        ]} />
      <Textarea label="CSV Content" value={csv} onChange={(e) => setCsv(e.target.value)} rows={8}
        placeholder="email,firstName,lastName,departmentCode&#10;john@company.com,John,Doe,IT" />
      <Button onClick={handleImport}>Import</Button>
      {result?.errors?.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4 text-sm dark:bg-red-950">
          <p className="font-medium">Validation Errors ({result.errorCount})</p>
          {result.errors.slice(0, 10).map((e, i) => <p key={i}>Row {e.row}: {e.message}</p>)}
        </div>
      )}
    </div>
  );
}

function ApprovalMatrixTab() {
  const [matrices, setMatrices] = useState([]);
  const [form, setForm] = useState({ workflowType: 'MAINTENANCE', name: '', steps: '[{"role":"ADMIN","action":"approve"}]' });

  useEffect(() => { api.get('/organization/approval-matrices').then(({ data }) => setMatrices(data.data)); }, []);

  const save = async () => {
    await api.post('/organization/approval-matrices', { ...form, steps: JSON.parse(form.steps) });
    toast.success('Approval matrix saved');
    const { data } = await api.get('/organization/approval-matrices');
    setMatrices(data.data);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <Select label="Workflow" value={form.workflowType} onChange={(e) => setForm({ ...form, workflowType: e.target.value })}
          options={['DEPARTMENT', 'MAINTENANCE', 'TRANSFER', 'PURCHASE', 'AUDIT'].map((v) => ({ value: v, label: v }))} />
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Textarea label="Steps (JSON)" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} rows={4} />
        <Button onClick={save}>Save Matrix</Button>
      </div>
      <div className="space-y-2">
        {matrices.map((m) => (
          <div key={m.id} className="rounded-lg border p-3 dark:border-gray-700">
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-gray-500">{m.workflowType}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartmentsTab() {
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', parentId: '', status: 'ACTIVE' });

  const load = async () => {
    const [d, all] = await Promise.all([
      api.get('/departments'),
      api.get('/departments/all'),
    ]);
    setData(d.data.data);
    setDepartments(all.data.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (edit) await api.put(`/departments/${edit.id}`, form);
      else await api.post('/departments', form);
      toast.success(edit ? 'Updated' : 'Created');
      setModal(false);
      setEdit(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'parent', label: 'Parent', render: (r) => r.parent?.name || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: 'Actions', render: (r) => (
      <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setForm({ name: r.name, code: r.code, description: r.description || '', parentId: r.parentId || '', status: r.status }); setModal(true); }}>
        <Pencil className="h-4 w-4" />
      </Button>
    )},
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEdit(null); setForm({ name: '', code: '', description: '', parentId: '', status: 'ACTIVE' }); setModal(true); }}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>
      <DataTable columns={columns} data={data} loading={loading} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Department' : 'New Department'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Select label="Parent Department" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            options={[{ value: '', label: 'None' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          <Button onClick={handleSave} className="w-full">Save</Button>
        </div>
      </Modal>
    </>
  );
}

function CategoriesTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', warrantyPeriod: '' });

  const load = () => api.get('/categories').then(({ data }) => { setData(data.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      const payload = { ...form, warrantyPeriod: form.warrantyPeriod ? parseInt(form.warrantyPeriod) : null };
      if (edit) await api.put(`/categories/${edit.id}`, payload);
      else await api.post('/categories', payload);
      toast.success('Saved');
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const columns = [
    { key: 'name', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'warranty', label: 'Warranty (months)', render: (r) => r.warrantyPeriod || '-' },
    { key: 'assets', label: 'Assets', render: (r) => r._count?.assets || 0 },
    { key: 'actions', label: '', render: (r) => (
      <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setForm({ name: r.name, description: r.description || '', warrantyPeriod: r.warrantyPeriod || '' }); setModal(true); }}><Pencil className="h-4 w-4" /></Button>
    )},
  ];

  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => { setEdit(null); setForm({ name: '', description: '', warrantyPeriod: '' }); setModal(true); }}><Plus className="h-4 w-4" /> Add Category</Button></div>
      <DataTable columns={columns} data={data} loading={loading} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title={edit ? 'Edit Category' : 'New Category'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Warranty Period (months)" type="number" value={form.warrantyPeriod} onChange={(e) => setForm({ ...form, warrantyPeriod: e.target.value })} />
          <Button onClick={handleSave} className="w-full">Save</Button>
        </div>
      </Modal>
    </>
  );
}

function EmployeesTab() {
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', departmentId: '', status: 'ACTIVE', role: 'EMPLOYEE' });

  const load = async () => {
    const [e, d] = await Promise.all([api.get('/employees'), api.get('/departments/all')]);
    setData(e.data.data);
    setDepartments(d.data.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      await api.put(`/employees/${edit.id}`, form);
      if (form.role !== edit.user?.role) {
        await api.patch(`/employees/${edit.id}/role`, { role: form.role });
      }
      toast.success('Updated');
      setModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
    { key: 'email', label: 'Email', render: (r) => r.user?.email },
    { key: 'dept', label: 'Department', render: (r) => r.department?.name || '-' },
    { key: 'role', label: 'Role', render: (r) => <StatusBadge status={r.user?.role} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => (
      <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setForm({ firstName: r.firstName, lastName: r.lastName, phone: r.phone || '', departmentId: r.departmentId || '', status: r.status, role: r.user?.role }); setModal(true); }}><Pencil className="h-4 w-4" /></Button>
    )},
  ];

  return (
    <>
      <p className="mb-4 text-sm text-gray-500">Assign Admin or Employee roles here. Signup always creates Employee accounts.</p>
      <DataTable columns={columns} data={data} loading={loading} />
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Edit Employee">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Department" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            options={[{ value: '', label: 'None' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: 'EMPLOYEE', label: 'Employee' },
              { value: 'ADMIN', label: 'Admin' },
            ]} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          <Button onClick={handleSave} className="w-full">Save</Button>
        </div>
      </Modal>
    </>
  );
}
