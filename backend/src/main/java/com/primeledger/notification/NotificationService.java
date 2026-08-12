package com.primeledger.notification;

import com.primeledger.common.ApiException;
import com.primeledger.notification.dto.NotificationResponse;
import com.primeledger.security.CurrentUserProvider;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    /** The bell is a dropdown, not an inbox. */
    private static final int FEED_LIMIT = 50;

    private final NotificationRepository notifications;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    public NotificationService(
            NotificationRepository notifications,
            CurrentUserProvider currentUser,
            Clock clock) {
        this.notifications = notifications;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> feed() {
        return notifications
                .findByUserIdOrderByCreatedAtDesc(
                        currentUser.currentUserId(), Limit.of(FEED_LIMIT))
                .stream()
                .map(NotificationService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return notifications.countByUserIdAndReadAtIsNull(currentUser.currentUserId());
    }

    @Transactional
    public NotificationResponse markRead(UUID id) {
        Notification notification =
                notifications
                        .findByIdAndUserId(id, currentUser.currentUserId())
                        .orElseThrow(() -> ApiException.notFound("Notification", id));

        if (!notification.isRead()) {
            notification.setReadAt(clock.instant());
            notifications.save(notification);
        }
        return toResponse(notification);
    }

    @Transactional
    public int markAllRead() {
        return notifications.markAllRead(currentUser.currentUserId(), clock.instant());
    }

    /**
     * Records a budget threshold crossing, at most once per threshold per period.
     *
     * <p>Runs in its own transaction, and that is load-bearing. The evaluator is
     * called from inside the transaction that just saved the user's transaction;
     * a constraint violation there would mark that transaction rollback-only and
     * destroy a perfectly good write to avoid sending a duplicate alert. A
     * separate transaction confines the damage to the notification.
     *
     * <p><strong>Throws on a duplicate rather than returning false.</strong> It
     * has to: once a flush has failed, the surrounding transaction is doomed
     * whatever this method does with the exception, and swallowing it here only
     * moves the failure to commit time as an {@code UnexpectedRollbackException}.
     * The caller catches it, outside this transaction boundary, where catching
     * actually works.
     *
     * @throws org.springframework.dao.DataIntegrityViolationException if this
     *     crossing has already been reported
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void emitBudgetThreshold(
            UUID userId,
            UUID budgetId,
            LocalDate periodStart,
            short threshold,
            String title,
            String body) {

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setKind(NotificationKind.BUDGET_THRESHOLD);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setBudgetId(budgetId);
        notification.setPeriodStart(periodStart);
        notification.setThreshold(threshold);

        notifications.saveAndFlush(notification);
    }

    /**
     * Whether this crossing has already been reported.
     *
     * <p>Read-only and cheap, so the evaluator can ask before writing. The unique
     * index is still what makes the guarantee — two evaluations racing will both
     * pass this check — but asking first keeps the overwhelmingly common case
     * from throwing.
     */
    @Transactional(readOnly = true)
    public boolean alreadyReported(
            UUID userId, UUID budgetId, LocalDate periodStart, short threshold) {
        return notifications.existsByUserIdAndBudgetIdAndPeriodStartAndThreshold(
                userId, budgetId, periodStart, threshold);
    }

    private static NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getKind(),
                notification.getTitle(),
                notification.getBody(),
                notification.getBudgetId(),
                notification.getPeriodStart(),
                notification.getThreshold(),
                notification.isRead(),
                notification.getCreatedAt());
    }
}
