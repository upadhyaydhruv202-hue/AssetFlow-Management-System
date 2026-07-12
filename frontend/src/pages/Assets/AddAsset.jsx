import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { PageHeader, Button, Input, Select, Textarea } from '../../components/Forms/FormElements';

export default function AddAsset() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    name: '', serialNumber: '', categoryId: '', acquisitionDate: '', acquisitionCost: '',
    condition: 'GOOD', location: '', isBookable: false, description: '',
  });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/categories/all').then(({ data }) => setCategories(data.data));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (photo) fd.append('photo', photo);
      await api.post('/assets', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Asset registered');
      navigate('/assets');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Register Asset" subtitle="Asset tag will be auto-generated (e.g. AF-0001)" />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <Input label="Asset Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Select label="Category *" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required
          options={[{ value: '', label: 'Select category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <Input label="Serial Number" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Acquisition Date" type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
          <Input label="Acquisition Cost" type="number" step="0.01" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} />
        </div>
        <Select label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}
          options={['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'].map((c) => ({ value: c, label: c }))} />
        <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div>
          <label className="mb-1 block text-sm font-medium">Photo</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} className="text-sm" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isBookable} onChange={(e) => setForm({ ...form, isBookable: e.target.checked })} />
          <span className="text-sm">Shared / Bookable resource</span>
        </label>
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Register Asset'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/assets')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
