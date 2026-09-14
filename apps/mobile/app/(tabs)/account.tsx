import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { City, UserProfileDto } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { LegalFooter } from "../../src/components/home/LegalFooter";
import { ScreenHeader } from "../../src/components/home/ScreenHeader";
import { LocationMapPicker } from "../../src/components/home/LocationMapPicker";
import {
  deleteAccount,
  fetchCities,
  linkPhone,
  requestEmailCode,
  sendOtp,
  updateProfile,
  verifyEmail,
} from "../../src/lib/bffClient";
import { useContactRevealBalanceQuery } from "../../src/lib/queries";
import { Icon } from "../../src/components/Icon";

type PhoneStep = "idle" | "otpSent";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

export default function AccountScreen() {
  const { colors } = useAppTheme();
  const { requireLogin, logout, isLoggedIn, accessToken, profile, refreshProfile } = useHomeSheets();
  const [loggingOut, setLoggingOut] = useState(false);

  /** No confirmation dialog: logging back in costs one OTP, so a mis-tap is cheap to undo, and the
   * button sits well away from Save. Router.replace("/") lands on Home rather than leaving the
   * user on a signed-out Account screen, which would immediately re-prompt for login. */
  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  }
  const router = useRouter();
  // Account is a tab root, not normally a pushed screen, but it's still reachable via a real
  // push from elsewhere (e.g. a deep link) — show a back arrow only when there's actually
  // somewhere to go back to, rather than always rendering one that does nothing on a fresh tab
  // switch.
  const onBack = router.canGoBack() ? () => router.back() : undefined;

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
    }, [isLoggedIn, requireLogin]),
  );

  if (!isLoggedIn) {
    // The login sheet is what's actually on screen here, but the entity disclosure has to be
    // reachable *without* an account — a verification reviewer won't sign up to find it.
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Account" onBack={onBack} />
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scrollContent}>
          <LegalFooter />
        </ScrollView>
      </View>
    );
  }

  if (!profile || !accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Account" onBack={onBack} />
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <ActivityIndicator color={colors.green} />
        </View>
      </View>
    );
  }

  return (
    <ProfileFields
      accessToken={accessToken}
      profile={profile}
      refreshProfile={refreshProfile}
      onOpenPurchases={() => router.push("/purchases")}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onBack={onBack}
    />
  );
}

function ProfileFields({
  accessToken,
  profile,
  refreshProfile,
  onOpenPurchases,
  onLogout,
  loggingOut,
  onBack,
}: {
  accessToken: string;
  profile: UserProfileDto;
  refreshProfile: () => Promise<void>;
  onOpenPurchases: () => void;
  onLogout: () => void;
  loggingOut: boolean;
  onBack?: () => void;
}) {
  const { colors } = useAppTheme();
  const { logout } = useHomeSheets();
  const router = useRouter();
  const { data: balance } = useContactRevealBalanceQuery(accessToken);

  const [name, setName] = useState(profile.name ?? "");
  // City — the profile's own "home city" (used e.g. for early-access alerts), distinct from
  // whichever city the Home tab is currently browsing. Batched into the same "Save changes" as
  // name rather than saving on selection, matching the website's ProfileForm exactly.
  const [cityId, setCityId] = useState(profile.cityId ?? undefined);
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<City[]>([]);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Same "no match — find it on the map" fallback as the website's ProfileForm, reusing the
  // posting wizard's own pin picker (LocationMapPicker) rather than sending the visitor
  // somewhere else — dropping a pin reverse-geocodes and creates the city if Bhavano doesn't
  // already cover it (LocationsService.ensureCity), the same path the wizard already uses.
  const [cityNoResults, setCityNoResults] = useState(false);
  const [showCityMap, setShowCityMap] = useState(false);
  const [newCityNote, setNewCityNote] = useState<string | null>(null);
  const [email, setEmail] = useState(profile.email ?? "");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phonePending, setPhonePending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<"idle" | "codeSent">("idle");
  const [emailCode, setEmailCode] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // App Store guideline 5.1.1(v) requires deletion to be startable in-app, and the DPDP Act
  // requires it regardless of the store — mirrors the website's identical flow.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteSent, setDeleteSent] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const emailMissing = !profile.email;
  const canSave = !!profile.phone && !emailMissing;

  async function onSendEmailCode() {
    setEmailPending(true);
    setEmailError(null);
    try {
      await requestEmailCode(accessToken, email.trim());
      setEmailStep("codeSent");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Couldn't send the code");
    } finally {
      setEmailPending(false);
    }
  }

  async function onVerifyEmailCode() {
    setEmailPending(true);
    setEmailError(null);
    try {
      const result = await verifyEmail(accessToken, email.trim(), emailCode);
      // A merge needing confirmation is web-only for now; on mobile the safe outcome is to tell
      // the user rather than silently do nothing, since nothing has moved.
      if (result.status === "confirm") {
        setEmailError("That email is on another account — open bhavano.com to combine them.");
        return;
      }
      await refreshProfile();
      setEmailStep("idle");
      setEmailCode("");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Couldn't verify the code");
    } finally {
      setEmailPending(false);
    }
  }

  async function onSendPhoneOtp() {
    setPhonePending(true);
    setPhoneError(null);
    try {
      await sendOtp(phoneInput);
      setPhoneStep("otpSent");
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setPhonePending(false);
    }
  }

  async function onVerifyPhoneOtp() {
    setPhonePending(true);
    setPhoneError(null);
    try {
      const result = await linkPhone(accessToken, phoneInput, otpInput);
      // Same as the email path: a merge needing confirmation is web-only for now, and nothing
      // has moved, so say so rather than appearing to succeed while the number stays unlinked.
      if (result.status === "confirm") {
        setPhoneError("That number is on another account — open bhavano.com to combine them.");
        return;
      }
      await refreshProfile();
      setPhoneStep("idle");
      setOtpInput("");
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Incorrect OTP");
    } finally {
      setPhonePending(false);
    }
  }

  function onCityQueryChange(value: string) {
    setCityQuery(value);
    setCityId(undefined);
    setCityNoResults(false);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (!value.trim()) {
      setCitySuggestions([]);
      return;
    }
    cityDebounceRef.current = setTimeout(async () => {
      const results = await fetchCities(value);
      setCitySuggestions(results);
      // Two characters in with nothing back is worth explaining — cities are a curated set, and
      // silence leaves the visitor unsure whether they mistyped or the city just isn't covered.
      setCityNoResults(results.length === 0 && value.trim().length >= 2);
    }, 300);
  }

  function onPickCity(city: City) {
    setCityId(city.id);
    setCityQuery(city.name);
    setCitySuggestions([]);
    setCityNoResults(false);
  }

  /** Sends the confirmation code to whichever identifier the account holds — phone first, since
   * that is the one every account has. Mirrors the website's identical helper. */
  async function sendDeleteCode() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      if (profile.phone) await sendOtp(profile.phone);
      else await requestEmailCode(accessToken, profile.email ?? "");
      setDeleteSent(true);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't send the code");
    } finally {
      setDeletePending(false);
    }
  }

  async function confirmDelete() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteAccount(
        accessToken,
        profile.phone ? { phone: profile.phone, code: deleteCode } : { email: profile.email ?? "", code: deleteCode },
      );
      // The session now points at an account with nothing behind it, so end it rather than
      // leave the visitor looking at an empty profile.
      await logout();
      router.replace("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't delete the account");
    } finally {
      setDeletePending(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      // No email here: an address only reaches the profile through the verified flow below,
      // mirroring how a phone only arrives through OTP. See
      // docs/plans/account-linking-phone-and-email.md.
      await updateProfile(accessToken, { name: name.trim() || undefined, cityId });
      await refreshProfile();
      setMessage({ type: "success", text: "Profile updated." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Account" onBack={onBack} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scrollContent}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>

      <Text style={[styles.label, { color: colors.muted }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>City</Text>
      <TextInput
        value={cityQuery || (profile.cityName ? `${profile.cityName}${profile.state ? `, ${profile.state}` : ""}` : "")}
        onChangeText={onCityQueryChange}
        onFocus={() => {
          // Clear the resolved "City, State" display text so editing starts a fresh search —
          // matches the website's own reasoning: backspacing into that combined string searches
          // for a fragment like "Bengaluru, Karnatak" that matches nothing.
          if (profile.cityName && !cityQuery) setCityQuery("");
        }}
        placeholder="Search for your city"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />
      {citySuggestions.length > 0 && (
        <View style={[styles.suggestionsBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {citySuggestions.map((c) => (
            <Pressable key={c.id} onPress={() => onPickCity(c)} style={styles.suggestionRow}>
              <Text style={{ color: colors.text, fontSize: 14 }}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {cityNoResults && !showCityMap && (
        <Text style={[styles.hint, { color: colors.muted }]}>
          No match yet.{" "}
          <Text style={{ color: colors.green, fontWeight: "700" }} onPress={() => setShowCityMap(true)}>
            Find it on the map
          </Text>{" "}
          and we&rsquo;ll add it.
        </Text>
      )}
      {showCityMap && (
        <View style={{ marginTop: 8 }}>
          <LocationMapPicker
            defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
            onPinChange={(_pin, suggestion) => {
              if (!suggestion?.cityId) return;
              setCityId(suggestion.cityId);
              setCityQuery(suggestion.cityName ?? "");
              setCityNoResults(false);
              setShowCityMap(false);
              setNewCityNote(
                suggestion.isNewCity ? `Added ${suggestion.cityName} — select Save to use it.` : null,
              );
            }}
          />
          <Pressable onPress={() => setShowCityMap(false)} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5 }}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {newCityNote && (
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>{newCityNote}</Text>
      )}

      <Text style={[styles.label, { color: colors.muted }]}>
        Email{!profile.email ? " *" : ""}
      </Text>
      {profile.email && (
        <View style={[styles.readOnly, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ color: colors.textSoft, fontSize: 14 }}>{profile.email}</Text>
          {profile.emailVerified ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
              <Icon name="check" size={12} color={colors.green} />
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Verified</Text>
            </View>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>Not verified</Text>
          )}
        </View>
      )}
      {/* Covers both "no email at all" and "saved but unverified" — an unverified address still
          reaches the visitor, but it isn't proof of who they are, so Google sign-in only merges
          into this account once it's verified. Without this a phone-first user who later typed
          an email in (but never got asked to prove it) kept ending up with two accounts. */}
      {!profile.emailVerified && (
        <>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {profile.email
              ? "Verify this address so signing in with Google brings you back to this same account."
              : "You signed in with your phone number — add an email so we have another way to reach you."}
          </Text>
          {emailStep === "idle" ? (
            <>
              {!profile.email && (
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                />
              )}
              <Pressable
                onPress={onSendEmailCode}
                disabled={emailPending || !email.includes("@")}
                style={[styles.row, { borderColor: colors.border, opacity: emailPending || !email.includes("@") ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                  {emailPending ? "Sending…" : "Send verification code"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.hint, { color: colors.muted }]}>
                We sent a 6-digit code to {email}.
              </Text>
              <TextInput
                value={emailCode}
                onChangeText={(t) => setEmailCode(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />
              <Pressable
                onPress={onVerifyEmailCode}
                disabled={emailPending || emailCode.length !== 6}
                style={[styles.row, { borderColor: colors.border, opacity: emailPending || emailCode.length !== 6 ? 0.6 : 1 }]}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                  {emailPending ? "Verifying…" : "Verify"}
                </Text>
              </Pressable>
            </>
          )}
          {emailError ? (
            <Text style={{ color: "#b3413a", fontSize: 12.5, marginTop: 6 }}>{emailError}</Text>
          ) : null}
        </>
      )}

      <Text style={[styles.label, { color: colors.muted }]}>
        Phone{!profile.phone ? " *" : ""}
      </Text>
      {profile.phone ? (
        <View style={[styles.readOnly, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ color: colors.textSoft, fontSize: 14 }}>{profile.phone}</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.muted }]}>
            You signed in with Google — add and verify a phone number so buyers/sellers can reach you.
          </Text>
          {phoneStep === "idle" ? (
            <>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                <View style={[styles.countryChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>+91</Text>
                </View>
                <TextInput
                  value={phoneInput}
                  onChangeText={(v) => setPhoneInput(v.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={[styles.input, { flex: 1, marginBottom: 0, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                />
              </View>
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              <Pressable
                onPress={onSendPhoneOtp}
                disabled={phoneInput.length !== 10 || phonePending}
                style={[styles.secondaryButton, { borderColor: colors.green, opacity: phoneInput.length === 10 ? 1 : 0.5 }]}
              >
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>
                  {phonePending ? "Sending…" : "Send OTP"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                value={otpInput}
                onChangeText={(v) => setOtpInput(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="······"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                style={[
                  styles.input,
                  { textAlign: "center", letterSpacing: 8, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                ]}
              />
              {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={onVerifyPhoneOtp}
                  disabled={otpInput.length !== 6 || phonePending}
                  style={[styles.secondaryButton, { borderColor: colors.green, opacity: otpInput.length === 6 ? 1 : 0.5 }]}
                >
                  <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>
                    {phonePending ? "Verifying…" : "Verify & link"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPhoneStep("idle");
                    setPhoneError(null);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14 }}
                >
                  <Icon name="chevronLeft" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Back</Text>
                </Pressable>
              </View>
            </>
          )}
        </>
      )}

      {message && (
        <Text style={{ color: message.type === "success" ? colors.green : "#c0554b", fontSize: 13, marginTop: 14 }}>
          {message.text}
        </Text>
      )}

      {/* App Store guideline 5.1.1(v) requires deletion to be startable in-app, and the DPDP Act
          requires it regardless of the store — mirrors the website's identical section. */}
      <View style={[styles.deleteSection, { borderColor: colors.border }]}>
        {!deleteOpen ? (
          <Pressable onPress={() => setDeleteOpen(true)}>
            <Text style={{ color: "#b3413a", fontWeight: "700", fontSize: 13 }}>Delete my account</Text>
          </Pressable>
        ) : (
          <View>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>
              Delete your account?
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 12 }}>
              Your ads come offline, your saved searches are removed, and your name, email and
              phone number are erased. Records of payments you made are kept for accounting, but
              no longer identify you. This can&rsquo;t be undone.
            </Text>
            {!deleteSent ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={sendDeleteCode}
                  disabled={deletePending}
                  style={[styles.dangerButton, { opacity: deletePending ? 0.6 : 1 }]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                    {deletePending ? "Sending…" : `Send code to my ${profile.phone ? "phone" : "email"}`}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDeleteOpen(false)}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={deleteCode}
                  onChangeText={(t) => setDeleteCode(t.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, marginBottom: 0 }]}
                />
                <Pressable
                  onPress={confirmDelete}
                  disabled={deletePending || deleteCode.length !== 6}
                  style={[styles.dangerButton, { alignSelf: "flex-start", opacity: deletePending || deleteCode.length !== 6 ? 0.6 : 1 }]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                    {deletePending ? "Deleting…" : "Delete permanently"}
                  </Text>
                </Pressable>
              </View>
            )}
            {deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
          </View>
        )}
      </View>

      {!canSave && (
        <Text style={[styles.hint, { color: colors.muted, marginTop: 14 }]}>
          {!profile.phone && emailMissing
            ? "Add your email above and verify your phone number above before saving."
            : !profile.phone
              ? "Verify your phone number above before saving."
              : "Add your email above before saving."}
        </Text>
      )}

      <Pressable
        onPress={onSave}
        disabled={saving || !canSave}
        style={[styles.primaryButton, { backgroundColor: colors.green, opacity: saving || !canSave ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{saving ? "Saving…" : "Save changes"}</Text>
      </Pressable>

      {/* Below Save rather than above with the editable fields — these aren't things you check
          while editing the form, and putting them after Save keeps the primary action from
          competing with them for attention on first load. Same order as the website's profile
          sidebar: credits, then the two "go elsewhere" links. */}
      <View style={[styles.balanceCard, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: 28 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Icon name="phone" size={15} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Contact reveal credits</Text>
        </View>
        {balance && (balance.freeRevealsRemaining > 0 || balance.creditsRemaining > 0) ? (
          <>
            {balance.freeRevealsRemaining > 0 && (
              <Text style={{ color: colors.textSoft, fontSize: 12.5 }}>
                {balance.freeRevealsRemaining} free reveal{balance.freeRevealsRemaining === 1 ? "" : "s"} left
              </Text>
            )}
            {balance.creditsRemaining > 0 && (
              <Text style={{ color: colors.textSoft, fontSize: 12.5 }}>
                {balance.creditsRemaining} purchased credit{balance.creditsRemaining === 1 ? "" : "s"}
                {balance.nextCreditExpiryAt ? ` — earliest expires ${new Date(balance.nextCreditExpiryAt).toLocaleDateString()}` : ""}
              </Text>
            )}
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>
            No reveals left. Buy a credit pack from any listing&rsquo;s &ldquo;View Contact&rdquo; button.
          </Text>
        )}
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/premium#contact-reveal-credits`)} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>See pricing →</Text>
        </Pressable>
      </View>

      {/* No native "My Listings" screen yet — opens the website's, same in-app-browser pattern
          UtilityBar/HomeDrawer already use for Tools/Plans/Help. */}
      <Pressable
        onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/my-listings`)}
        style={[styles.outlineButton, { borderColor: colors.green }]}
      >
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>View and edit your listings</Text>
      </Pressable>

      <Pressable onPress={onOpenPurchases} style={[styles.outlineButton, { borderColor: colors.green }]}>
        <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>View your purchase history</Text>
      </Pressable>

      {/* Below Save, above the legal footer: reachable but not adjacent to the primary action,
          so it can't be hit by mistake while editing the profile. */}
      <Pressable
        onPress={onLogout}
        disabled={loggingOut}
        style={[styles.logoutButton, { borderColor: colors.border, opacity: loggingOut ? 0.6 : 1 }]}
      >
        <Text style={{ color: "#c0554b", fontWeight: "700", fontSize: 14 }}>
          {loggingOut ? "Logging out…" : "Log out"}
        </Text>
      </Pressable>

      <LegalFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  row: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignSelf: "flex-start", marginBottom: 28 },
  balanceCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 3, marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 16, textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 12.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, marginBottom: 4 },
  suggestionsBox: { borderWidth: 1, borderRadius: 9, marginBottom: 4, overflow: "hidden" },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 14 },
  readOnly: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14 },
  countryChip: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, justifyContent: "center" },
  secondaryButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", alignSelf: "flex-start" },
  primaryButton: { borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 24 },
  outlineButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  logoutButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 32 },
  errorText: { color: "#c0554b", fontSize: 13, marginBottom: 8 },
  deleteSection: { borderTopWidth: 1, paddingTop: 18, marginTop: 18 },
  dangerButton: { backgroundColor: "#b3413a", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center" },
});
