import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications';
import { queryKeys } from '../lib/queryClient';
import type { Notification } from '../types';

/**
 * What the bell shows (F-02).
 *
 * <p>The count is its own query rather than a length of the list. The list is
 * capped at fifty by the server, so counting unread entries in it would report
 * "50" for a user with more, and the dot exists precisely to be trusted.
 */
export function useNotifications() {
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
  });

  const unread = useQuery({
    queryKey: [...queryKeys.notifications, 'unread-count'] as const,
    queryFn: fetchUnreadCount,
    // Alerts arrive from the server's own nightly sweep as well as from the
    // user's writes, so unlike everything else here the browser has no local
    // event to hang a refetch on. A minute is often enough to notice a crossing
    // without polling the API into the ground.
    refetchInterval: 60_000,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  /**
   * Marks one read, showing it immediately.
   *
   * <p>Optimistic here, unlike the account writes: this is a read receipt, and
   * the worst case for guessing wrong is a dot that comes back on the next
   * refetch. The user has plainly just read the thing.
   */
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });

      const previous = queryClient.getQueryData<Notification[]>(queryKeys.notifications);
      const wasUnread = previous?.find((entry) => entry.id === id)?.isRead === false;

      queryClient.setQueryData<Notification[]>(queryKeys.notifications, (cached) =>
        cached?.map((entry) => (entry.id === id ? { ...entry, isRead: true } : entry)),
      );

      if (wasUnread) {
        queryClient.setQueryData<number>(
          [...queryKeys.notifications, 'unread-count'],
          (count) => Math.max(0, (count ?? 1) - 1),
        );
      }
      return previous;
    },
    onError: (_error, _id, previous) => {
      if (previous) queryClient.setQueryData(queryKeys.notifications, previous);
    },
    onSettled: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });

      const previous = queryClient.getQueryData<Notification[]>(queryKeys.notifications);

      queryClient.setQueryData<Notification[]>(queryKeys.notifications, (cached) =>
        cached?.map((entry) => ({ ...entry, isRead: true })),
      );
      queryClient.setQueryData<number>([...queryKeys.notifications, 'unread-count'], 0);

      return previous;
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(queryKeys.notifications, previous);
    },
    onSettled: invalidate,
  });

  return {
    notifications: notifications.data ?? [],
    unreadCount: unread.data ?? 0,
    isLoading: notifications.isPending,
    error: notifications.error,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}
