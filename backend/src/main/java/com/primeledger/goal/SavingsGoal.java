package com.primeledger.goal;

import com.primeledger.common.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A named savings target attached to an account (F-04).
 *
 * <p>Four columns, and no fifth. Progress, the contribution needed to hit the
 * date, the rate the user is actually managing and the date they will actually
 * arrive are all computed in {@link SavingsGoalService} from the account's
 * transactions — they are answers about the present, and a stored answer about
 * the present is a wrong answer from tomorrow onwards.
 */
@Entity
@Table(name = "savings_goals")
@Getter
@Setter
@NoArgsConstructor
public class SavingsGoal extends Auditable {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /**
     * The account whose balance <em>is</em> the progress. Not a pot of its own:
     * a goal is a way of reading an account, which is why saving towards it is
     * an ordinary transfer and needs no special transaction type.
     */
    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "target_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal targetAmount;

    /** Optional: "save 500,000, whenever" is a real goal, just an undated one. */
    @Column(name = "target_date")
    private LocalDate targetDate;
}
