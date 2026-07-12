import { Link } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';

const healthColor = (score) => {
  if (score >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
  if (score >= 60) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
  return 'text-red-600 bg-red-100 dark:bg-red-900/30';
};

export default function AssetHealthWidget({ assets = [] }) {
  if (!assets.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary-600" />
        <h3 className="font-semibold">Asset Health</h3>
      </div>
      <div className="space-y-2">
        {assets.map((a) => (
          <Link key={a.id} to={`/assets/${a.id}`} className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
            <div>
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-xs text-gray-500">{a.assetTag}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${healthColor(a.healthScore)}`}>
              {a.healthScore}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
