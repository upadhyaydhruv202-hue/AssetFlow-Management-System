import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye } from 'lucide-react';
import api from '../../services/api';
import { PageHeader, Button, Input, Select } from '../../components/Forms/FormElements';
import DataTable, { StatusBadge } from '../../components/Table/DataTable';

export default function AssetList() {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', categoryId: '', status: '' });

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.status) params.set('status', filters.status);
    const { data } = await api.get(`/assets?${params}`);
    setAssets(data.data);
    setLoading(false);
  };

  useEffect(() => {
    api.get('/categories/all').then(({ data }) => setCategories(data.data));
    load();
  }, []);

  const columns = [
    { key: 'tag', label: 'Asset Tag', render: (r) => <span className="font-mono font-medium text-primary-600">{r.assetTag}</span> },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', render: (r) => r.category?.name },
    { key: 'serial', label: 'Serial', render: (r) => r.serialNumber || '-' },
    { key: 'location', label: 'Location', render: (r) => r.location || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'holder', label: 'Current Holder', render: (r) => {
      const alloc = r.allocations?.[0];
      if (!alloc) return '-';
      return alloc.employee ? `${alloc.employee.firstName} ${alloc.employee.lastName}` : alloc.department?.name || '-';
    }},
    { key: 'actions', label: '', render: (r) => (
      <Link to={`/assets/${r.id}`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
    )},
  ];

  return (
    <div>
      <PageHeader title="Asset Directory" subtitle="Search and track all registered assets"
        action={<Link to="/assets/add"><Button><Plus className="h-4 w-4" /> Register Asset</Button></Link>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-10" placeholder="Search by tag, name, serial..." value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </div>
        <Select className="w-40" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select className="w-40" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          options={[
            { value: '', label: 'All Status' },
            { value: 'AVAILABLE', label: 'Available' },
            { value: 'ALLOCATED', label: 'Allocated' },
            { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
            { value: 'LOST', label: 'Lost' },
          ]} />
        <Button variant="secondary" onClick={load}>Filter</Button>
      </div>

      <DataTable columns={columns} data={assets} loading={loading} />
    </div>
  );
}
