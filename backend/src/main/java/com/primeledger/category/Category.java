package com.primeledger.category;

import com.primeledger.common.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A spending or income category.
 *
 * <p>This is the row that replaces the TypeScript {@code Category} union and
 * closes D-01: the form's options and the type can no longer drift apart,
 * because there is only one of them (proposal §7.3).
 *
 * <p>A {@code null} {@link #userId} marks a system category — seeded in V3,
 * visible to every user, editable by none.
 */
@Entity
@Table(name = "categories")
@Getter
@Setter
@NoArgsConstructor
public class Category extends Auditable {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", updatable = false)
    private UUID userId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "kind", nullable = false)
    private CategoryKind kind;

    @Column(name = "icon")
    private String icon;

    @Column(name = "colour")
    private String colour;

    @Column(name = "is_system", nullable = false)
    private boolean system;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    /** System categories are read-only to everyone, including their "owner". */
    public boolean isEditable() {
        return !system;
    }
}
