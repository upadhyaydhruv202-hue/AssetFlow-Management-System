import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../services/api';
import { PageHeader, Button } from '../../components/Forms/FormElements';
import { CheckCheck, Trash2, Sparkles } from 'lucide-react';
import usePolling from '../../hooks/usePolling';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [grouped, setGrouped] = useState({});

  const load = async () => {
    const [notifRes, aiRes] = await Promise.all([
      api.get('/notifications?limit=50'),
      api.get('/notifications/ai-summary'),
    ]);
    setNotifications(notifRes.data.data);
    setUnread(notifRes.data.unreadCount);
    setAiSummary(aiRes.data.data);
    setGrouped(aiRes.data.data.grouped || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  usePolling(load, 15000);

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    toast.success('All marked as read');
    load();
  };

  const deleteNotif = async (id) => {
    await api.delete(`/notifications/${id}`);
    load();
  };

  const typeColors = {
    ASSET_ASSIGNED: 'border-l-blue-500',
    OVERDUE_RETURN: 'border-l-red-500',
    BOOKING_CONFIRMED: 'border-l-green-500',
    BOOKING_REMINDER: 'border-l-yellow-500',
    MAINTENANCE_APPROVED: 'border-l-green-500',
    MAINTENANCE_REJECTED: 'border-l-red-500',
    AUDIT_DISCREPANCY: 'border-l-orange-500',
    SECURITY_ALERT: 'border-l-red-600',
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread} unread notifications`}
        action={unread > 0 && <Button variant="secondary" onClick={markAllRead}><CheckCheck className="h-4 w-4" /> Mark All Read</Button>} />

      {aiSummary && (
        <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary-600" /><h3 className="font-semibold">AI Summary</h3></div>
          <p className="mt-2 text-sm">{aiSummary.summary}</p>
        </div>
      )}

      {Object.keys(grouped).length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(grouped).map(([group, items]) => (
            <span key={group} className="rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">{group}: {items.length}</span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => (
          <div key={n.id} className={`rounded-xl border border-gray-200 border-l-4 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${typeColors[n.type] || 'border-l-gray-400'} ${!n.isRead ? 'ring-1 ring-primary-100 dark:ring-primary-900' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{n.title}</h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.message}</p>
                <p className="mt-2 text-xs text-gray-400">{format(new Date(n.createdAt), 'MMM d, yyyy HH:mm')}</p>
              </div>
              <div className="flex gap-1">
                {!n.isRead && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}><CheckCheck className="h-4 w-4" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => deleteNotif(n.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
        {!notifications.length && <p className="text-center text-gray-500 py-12">No notifications</p>}
      </div>
    </div>
  );
}
