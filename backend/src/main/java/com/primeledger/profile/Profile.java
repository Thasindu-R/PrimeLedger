package com.primeledger.profile;

import com.primeledger.common.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Per-user settings, keyed by the Supabase {@code auth.users.id} (§6.3).
 *
 * <p>The id is the user id rather than a generated one: there is exactly one
 * profile per user, and a surrogate key would add a second way to say the same
 * thing and a way for the two to disagree.
 *
 * <p>Phase 6 is what finally made this table load-bearing. {@link
 * #baseCurrency} is the currency every reporting total is expressed in (F-05) —
 * without it, an app with a rupee account and a dollar account can only add the
 * two numbers together and hope nobody looks.
 */
@Entity
@Table(name = "profiles")
@Getter
@Setter
@NoArgsConstructor
public class Profile extends Auditable {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    // CHAR(3) in V1, which PostgreSQL reports as bpchar; without this Hibernate
    // expects varchar and fails validation on start-up.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "base_currency", nullable = false, length = 3)
    private String baseCurrency;

    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "theme", nullable = false)
    private String theme;

    @Column(name = "date_format", nullable = false)
    private String dateFormat;
}
