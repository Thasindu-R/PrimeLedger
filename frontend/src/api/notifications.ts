import { apiJson } from './client';
import { notificationSchema, type WireNotification } from '../schemas/api';
import type { Notification } from '../types';

/**
 * Budget threshold crossings, newest first, capped at 50 by the server.
 *
 * <p>Not a feed of everything that has happened: the bell shows things the user
 * needs to know about, and "you added a transaction" is not one of them — they
 * added it. Before Phase 5 the menu showed recent transactions because there was
 * nothing else to put there.
 */
export async function listNotifications(): Promise<Notification[]> {
  const body = await apiJson<unknown>('/notifications');
  return notificationSchema.array().parse(body).map(toNotification);
}

/** The dot on the bell. */
export async function fetchUnreadCount(): Promise<number> {
  const body = await apiJson<{ unread: number }>('/notifications/unread-count');
  return body.unread;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiJson<unknown>(`/notifications/${id}/read`, { method: 'POST' });
}

/** Returns how many were actually marked, which is not always how many were shown. */
export async function markAllNotificationsRead(): Promise<number> {
  const body = await apiJson<{ marked: number }>('/notifications/read-all', {
    method: 'POST',
  });
  return body.marked;
}

export function toNotification(wire: WireNotification): Notification {
  return {
    id: wire.id,
    kind: wire.kind,
    title: wire.title,
    body: wire.body,
    budgetId: wire.budgetId ?? undefined,
    periodStart: wire.periodStart ?? undefined,
    threshold: wire.threshold ?? undefined,
    isRead: wire.read,
    createdAt: wire.createdAt,
  };
}
