import type { LucideIcon } from 'lucide-react';
import { Receipt } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  /** What to do about it — first-run guidance rather than a dead end (FR-45). */
  hint?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  hint,
  icon: Icon = Receipt,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 px-6 text-center text-gray-400">
      <Icon size={44} className="mb-1" />
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {hint && <p className="text-sm max-w-sm">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
