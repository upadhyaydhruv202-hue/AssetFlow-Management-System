import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { format, addDays, startOfWeek, addHours } from 'date-fns';
import api from '../../services/api';
import { PageHeader, Button, Input, Select, Textarea } from '../../components/Forms/FormElements';
import DataTable, { StatusBadge } from '../../components/Table/DataTable';
import Modal from '../../components/Modals/Modal';
import { Plus, Calendar } from 'lucide-react';

export default function BookingsPage() {
  const [tab, setTab] = useState('calendar');
  const [bookings, setBookings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [assetBookings, setAssetBookings] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ assetId: '', title: '', startTime: '', endTime: '', notes: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [b, a] = await Promise.all([
      api.get('/bookings/my'),
      api.get('/assets/bookable'),
    ]);
    setBookings(b.data.data);
    setAssets(a.data.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedAsset) {
      const start = startOfWeek(new Date());
      const end = addDays(start, 7);
      api.get(`/bookings/asset/${selectedAsset}?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
        .then(({ data }) => setAssetBookings(data.data));
    }
  }, [selectedAsset]);

  const handleBook = async () => {
    try {
      await api.post('/bookings', form);
      toast.success('Booking confirmed');
      setModal(false);
      load();
      if (selectedAsset) {
        api.get(`/bookings/asset/${selectedAsset}`).then(({ data }) => setAssetBookings(data.data));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed - time slot may overlap');
    }
  };

  const handleCancel = async (id) => {
    await api.post(`/bookings/${id}/cancel`);
    toast.success('Booking cancelled');
    load();
  };

  const historyColumns = [
    { key: 'asset', label: 'Resource', render: (r) => r.asset?.name },
    { key: 'title', label: 'Title', render: (r) => r.title || '-' },
    { key: 'start', label: 'Start', render: (r) => format(new Date(r.startTime), 'MMM d, yyyy HH:mm') },
    { key: 'end', label: 'End', render: (r) => format(new Date(r.endTime), 'MMM d, yyyy HH:mm') },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', render: (r) => ['UPCOMING', 'ONGOING'].includes(r.status) ? (
      <Button size="sm" variant="danger" onClick={() => handleCancel(r.id)}>Cancel</Button>
    ) : null },
  ];

  return (
    <div>
      <PageHeader title="Resource Booking" subtitle="Book shared resources with overlap validation"
        action={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> New Booking</Button>} />

      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button onClick={() => setTab('calendar')} className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === 'calendar' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
          <Calendar className="inline h-4 w-4 mr-1" /> Calendar View
        </button>
        <button onClick={() => setTab('history')} className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === 'history' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
          My Bookings
        </button>
      </div>

      {tab === 'calendar' && (
        <div className="space-y-4">
          <Select label="Select Resource" value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)} className="max-w-md"
            options={[{ value: '', label: 'Choose a bookable resource' }, ...assets.map((a) => ({ value: a.id, label: `${a.assetTag} - ${a.name}` }))]} />

          {selectedAsset && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-4 font-semibold">Existing Bookings</h3>
              {assetBookings.length === 0 ? (
                <p className="text-gray-500">No bookings for this resource</p>
              ) : (
                <div className="space-y-2">
                  {assetBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                      <div>
                        <span className="font-medium">{format(new Date(b.startTime), 'MMM d HH:mm')} - {format(new Date(b.endTime), 'HH:mm')}</span>
                        <span className="ml-2 text-sm text-gray-500">{b.employee?.firstName} {b.employee?.lastName}</span>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && <DataTable columns={historyColumns} data={bookings} loading={loading} />}

      <Modal isOpen={modal} onClose={() => setModal(false)} title="New Booking">
        <div className="space-y-4">
          <Select label="Resource" value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...assets.map((a) => ({ value: a.id, label: `${a.assetTag} - ${a.name}` }))]} />
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Start Time" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <Input label="End Time" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <p className="text-xs text-gray-500">Overlapping bookings will be automatically rejected.</p>
          <Button onClick={handleBook} className="w-full">Book Resource</Button>
        </div>
      </Modal>
    </div>
  );
}
