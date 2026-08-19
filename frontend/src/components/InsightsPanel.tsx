import { Link } from 'react-router-dom';
import { AlertTriangle, Lightbulb, Sparkles, TrendingUp } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import type { Insight, InsightTone } from '../types';

interface InsightsPanelProps {
  insights: Insight[];
  isLoading: boolean;
}

/** Tone decides the colour and the icon; the rule decides the words. */
const TONE_STYLES: Record<InsightTone, { border: string; icon: string; Icon: typeof AlertTriangle }> =
  {
    WARNING: { border: 'border-l-amber-400', icon: 'text-amber-500', Icon: AlertTriangle },
    NEUTRAL: { border: 'border-l-gray-300', icon: 'text-gray-400', Icon: Lightbulb },
    GOOD: { border: 'border-l-green-400', icon: 'text-green-500', Icon: TrendingUp },
  };

/**
 * Plain-language observations about the month (F-07, FR-30).
 *
 * <p>Renders nothing at all when there is nothing to say. A panel that always
 * finds an observation is one the user learns to skip, and the value of this
 * feature is entirely in being worth reading on the day it says something.
 */
export function InsightsPanel({ insights, isLoading }: InsightsPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <section
      aria-label="Insights"
      className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-green-500" />
        <h2 className="text-sm font-semibold text-gray-800">What we noticed</h2>
      </div>

      <ul className="space-y-3">
        {insights.map((insight, index) => (
          <InsightRow key={`${insight.kind}-${insight.subjectId ?? index}`} insight={insight} />
        ))}
      </ul>
    </section>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const style = TONE_STYLES[insight.tone];
  const { Icon } = style;

  return (
    <li className={`border-l-2 ${style.border} pl-3`}>
      <div className="flex items-start gap-2">
        <Icon size={15} className={`${style.icon} mt-0.5 shrink-0`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{insight.title}</p>
          <p className="text-xs leading-relaxed text-gray-500">{insight.detail}</p>
          {/* Only category insights link anywhere. A transaction one names a row
              the transactions page cannot yet be deep-linked to, and a link that
              lands on an unfiltered list is worse than no link. */}
          {insight.kind === 'CATEGORY_SHIFT' && insight.subjectName && (
            <Link
              to="/transactions"
              className="mt-0.5 inline-block text-xs text-green-600 hover:underline"
            >
              See {insight.subjectName} transactions
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
