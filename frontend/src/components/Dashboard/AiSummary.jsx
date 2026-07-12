import { Sparkles } from 'lucide-react';

export default function AiSummary({ summary }) {
  if (!summary?.lines?.length) return null;
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-950/30">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <h3 className="font-semibold text-primary-900 dark:text-primary-100">AI Daily Summary</h3>
      </div>
      <ul className="space-y-1 text-sm text-primary-800 dark:text-primary-200">
        {summary.lines.map((line, i) => <li key={i}>• {line}</li>)}
      </ul>
    </div>
  );
}
