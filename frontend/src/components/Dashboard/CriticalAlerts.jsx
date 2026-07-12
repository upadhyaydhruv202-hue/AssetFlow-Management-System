import { AlertTriangle, Shield, Wrench, ClipboardCheck } from 'lucide-react';

const icons = {
  OVERDUE_ASSETS: AlertTriangle,
  CRITICAL_MAINTENANCE: Wrench,
  SECURITY_ALERTS: Shield,
  AUDIT_ISSUES: ClipboardCheck,
};

export default function CriticalAlerts({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const Icon = icons[alert.type] || AlertTriangle;
        const colors = alert.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' :
          alert.severity === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30' :
          'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30';
        return (
          <div key={alert.type} className={`flex items-center gap-3 rounded-lg border-l-4 p-3 ${colors}`}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
