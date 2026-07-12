import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import api from '../../services/api';
import { PageHeader } from '../../components/Forms/FormElements';
import DataTable from '../../components/Table/DataTable';

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/activity?limit=50').then(({ data }) => {
      setLogs(data.data);
      setLoading(false);
    });
  }, []);

  const columns = [
    { key: 'time', label: 'Time', render: (r) => format(new Date(r.createdAt), 'MMM d, yyyy HH:mm:ss') },
    { key: 'user', label: 'User', render: (r) => r.user?.employee ? `${r.user.employee.firstName} ${r.user.employee.lastName}` : r.user?.email },
    { key: 'action', label: 'Action', render: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: 'entity', label: 'Entity', render: (r) => `${r.entityType}${r.entityId ? ` (${r.entityId.slice(0, 8)}...)` : ''}` },
  ];

  return (
    <div>
      <PageHeader title="Activity Logs" subtitle="Full audit trail of system actions" />
      <DataTable columns={columns} data={logs} loading={loading} />
    </div>
  );
}
