package com.primeledger.profile;

import com.primeledger.profile.dto.ProfileRequest;
import com.primeledger.profile.dto.ProfileResponse;
import com.primeledger.security.CurrentUserProvider;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The caller's profile, created on first use (§6.3).
 *
 * <p>Provisioned lazily rather than by a sign-up hook. Supabase owns
 * registration, so there is no server-side moment when a user is created that
 * this application would hear about; the alternative to lazy creation is a
 * database trigger on {@code auth.users}, which would put application defaults
 * in a schema Supabase manages and upgrades. The same reasoning gave accounts
 * {@code ensureDefault}.
 */
@Service
public class ProfileService {

    static final String DEFAULT_DISPLAY_NAME = "Guest";
    static final String DEFAULT_BASE_CURRENCY = "USD";
    static final String DEFAULT_LOCALE = "en-US";
    static final String DEFAULT_THEME = "system";
    static final String DEFAULT_DATE_FORMAT = "yyyy-MM-dd";

    private final ProfileRepository profiles;
    private final CurrentUserProvider currentUser;

    public ProfileService(ProfileRepository profiles, CurrentUserProvider currentUser) {
        this.profiles = profiles;
        this.currentUser = currentUser;
    }

    @Transactional
    public ProfileResponse current() {
        return toResponse(ensure(currentUser.currentUserId()));
    }

    @Transactional
    public ProfileResponse update(ProfileRequest request) {
        Profile profile = ensure(currentUser.currentUserId());

        profile.setDisplayName(request.displayName().trim());
        profile.setAvatarUrl(blankToNull(request.avatarUrl()));
        profile.setBaseCurrency(request.baseCurrency());
        profile.setLocale(orDefault(request.locale(), DEFAULT_LOCALE));
        profile.setTheme(orDefault(request.theme(), DEFAULT_THEME));
        profile.setDateFormat(orDefault(request.dateFormat(), DEFAULT_DATE_FORMAT));

        return toResponse(profiles.saveAndFlush(profile));
    }

    /**
     * The currency this user's reporting totals are expressed in (F-05).
     *
     * <p>Read through the same lazy provisioning as everything else, so a user
     * who has never opened Settings still has an answer.
     */
    @Transactional
    public String baseCurrencyOf(UUID userId) {
        return ensure(userId).getBaseCurrency();
    }

    // ---------------------------------------------------------------- internals

    private Profile ensure(UUID userId) {
        return profiles.findById(userId).orElseGet(() -> create(userId));
    }

    private Profile create(UUID userId) {
        Profile profile = new Profile();
        profile.setId(userId);
        profile.setDisplayName(DEFAULT_DISPLAY_NAME);
        profile.setBaseCurrency(DEFAULT_BASE_CURRENCY);
        profile.setLocale(DEFAULT_LOCALE);
        profile.setTheme(DEFAULT_THEME);
        profile.setDateFormat(DEFAULT_DATE_FORMAT);

        try {
            return profiles.saveAndFlush(profile);
        } catch (DataIntegrityViolationException race) {
            // Two tabs loading at once both saw no profile. The row the loser
            // wanted now exists, so return it rather than failing a request the
            // user did not make.
            return profiles.findById(userId).orElseThrow(() -> race);
        }
    }

    private static ProfileResponse toResponse(Profile profile) {
        return new ProfileResponse(
                profile.getId(),
                profile.getDisplayName(),
                profile.getAvatarUrl(),
                profile.getBaseCurrency(),
                profile.getLocale(),
                profile.getTheme(),
                profile.getDateFormat());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String orDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
