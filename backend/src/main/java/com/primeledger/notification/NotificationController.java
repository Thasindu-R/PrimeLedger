package com.primeledger.notification;

import com.primeledger.notification.dto.NotificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Notifications", description = "What the bell carries (F-02)")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "The caller's notifications, newest first")
    public List<NotificationResponse> feed() {
        return service.feed();
    }

    @GetMapping("/unread-count")
    @Operation(
            summary = "How many are unread",
            description = "The number behind the dot on the bell.")
    public Map<String, Long> unreadCount() {
        return Map.of("unread", service.unreadCount());
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Mark one as read")
    public NotificationResponse markRead(@PathVariable UUID id) {
        return service.markRead(id);
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark everything as read")
    public Map<String, Integer> markAllRead() {
        return Map.of("marked", service.markAllRead());
    }
}
