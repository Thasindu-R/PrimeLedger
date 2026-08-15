import { AlertTriangle, Bell, TrendingUp } from 'lucide-react';
import type { Notification } from '../types';

interface NotificationsMenuProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

/**
 * The bell's contents (F-02).
 *
 * <p>Budget threshold crossings, not a feed of everything that has happened.
 * Until Phase 5 this listed recent transactions, which was the only thing there
 * was to put in it — and telling someone about the transaction they just entered
 * is not news. A budget quietly passing 80% is.
 */
export function NotificationsMenu({
  notifications,
  isLoading,
  onMarkRead,
  onMarkAllRead,
}: NotificationsMenuProps) {
  const hasUnread = notifications.some((entry) => !entry.isRead);

  return (
    <div className="absolute right-0 top-14 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white py-2 shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <span className="text-sm font-semibold text-gray-800">Alerts</span>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={!hasUnread}
          className="text-xs font-medium text-green-600 hover:text-green-700 disabled:text-gray-300"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto py-2">
        {isLoading ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-300">
            <Bell size={32} />
            <p className="mt-2 text-sm">Nothing needs your attention</p>
            <p className="mt-1 px-6 text-center text-xs text-gray-400">
              Set a budget and you will hear from us at 80% and again if you go over.
            </p>
          </div>
        ) : (
          notifications.map((entry) => (
            <button
              type="button"
              key={entry.id}
              onClick={() => !entry.isRead && onMarkRead(entry.id)}
              className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 ${
                entry.isRead ? '' : 'bg-green-50/40'
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 ${
                  entry.threshold && entry.threshold >= 100
                    ? 'text-red-500'
                    : 'text-amber-500'
                }`}
              >
                {entry.threshold && entry.threshold >= 100 ? (
                  <AlertTriangle size={16} />
                ) : (
                  <TrendingUp size={16} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm ${
                    entry.isRead ? 'text-gray-600' : 'font-medium text-gray-800'
                  }`}
                >
                  {entry.title}
                </span>
                <span className="mt-0.5 block text-xs text-gray-400">{entry.body}</span>
              </span>

              {!entry.isRead && (
                <span
                  aria-label="Unread"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-500"
                />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
