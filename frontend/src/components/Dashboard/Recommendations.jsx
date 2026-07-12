import { Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';

export default function Recommendations({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold">Smart Recommendations</h3>
      </div>
      <div className="space-y-2">
        {items.map((r, i) => (
          <Link key={i} to={r.link || '#'} className="block rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-xs text-gray-500">{r.message}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
