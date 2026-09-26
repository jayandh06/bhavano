import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextInput } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { AccountMergeSummary, City, LinkIdentifierResult } from "@bhavano/types";
import {
  BffError,
  confirmAccountMerge,
  fetchCities,
  linkPhone,
  requestEmailCode,
  sendOtp,
  updateProfile,
  verifyEmail,
} from "../../lib/bffClient";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

const MIN_CITY_QUERY = 2;

/** Focuses an input a beat after it mounts instead of via `autoFocus`. This step lives in a
 * bottom sheet that re-snaps (55% -> 85%) as it swaps in; `autoFocus` opened the keyboard in the
 * middle of that animation, so the sheet's own keyboard handling and the sheet's movement kept
 * re-adjusting each other and the whole screen jumped up and down on Android. Module-level so the
 * callback ref's identity is stable — an inline one would re-run (and refocus) on every render. */
const focusAfterSheetSettles = (node: TextInput | null | undefined) => {
  if (node) setTimeout(() => node.focus(), 450);
};

export type SecondaryNeed = "phone" | "email" | null;

export interface ProfileBasicsValues {
  name: string;
  cityId: string | null;
  cityName: string | null;
  phone: string | null;
  email: string | null;
  emailVerified: boolean;
  needSecondary: SecondaryNeed;
}

export function profileNeedsBasics(profile: {
  name: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
  cityId: string | null;
}): boolean {
  return (
    !profile.name?.trim() ||
    secondaryNeedFromProfile(profile) !== null ||
    !profile.cityId
  );
}

/** Mandatory only (name + verified secondary) — session restore / cold start. */
export function profileNeedsMandatoryBasics(profile: {
  name: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
}): boolean {
  return !profile.name?.trim() || secondaryNeedFromProfile(profile) !== null;
}

export function secondaryNeedFromProfile(profile: {
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
}): SecondaryNeed {
  if (!profile.phone) return "phone";
  if (!profile.email || !profile.emailVerified) return "email";
  return null;
}

export function basicsFromProfile(profile: {
  name: string | null;
  phone?: string | null;
  email?: string | null;
  emailVerified: boolean;
  cityId: string | null;
  cityName: string | null;
}): ProfileBasicsValues {
  return {
    name: profile.name?.trim() ?? "",
    cityId: profile.cityId,
    cityName: profile.cityName,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    emailVerified: profile.emailVerified,
    needSecondary: secondaryNeedFromProfile(profile),
  };
}

export function canDismissBasics(initial: ProfileBasicsValues): boolean {
  return initial.name.trim().length > 0 && initial.needSecondary === null;
}

type Phase =
  | "details"
  | "askPhone"
  | "askOtp"
  | "askEmail"
  | "askEmailCode"
  | "confirmMerge";

/**
 * Post-login name + mandatory verified secondary + optional city —
 * see docs/plans/post-login-name-and-city.md.
 */
export function ProfileBasicsStep({
  accessToken,
  initial,
  onSaved,
  onSkip,
  onReauthRequired,
}: {
  accessToken: string;
  initial: ProfileBasicsValues;
  onSaved: (saved: ProfileBasicsValues & { city: City | null }) => void;
  onSkip: () => void;
  onReauthRequired: () => void;
}) {
  const { colors } = useAppTheme();
  const [name, setName] = useState(initial.name);
  const [cityId, setCityId] = useState<string | null>(initial.cityId);
  const [cityName, setCityName] = useState<string | null>(initial.cityName);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [cityNoResults, setCityNoResults] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("details");
  const [secondaryDone, setSecondaryDone] = useState(initial.needSecondary === null);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [mergeSummary, setMergeSummary] = useState<AccountMergeSummary | null>(null);

  const nameOk = name.trim().length > 0;
  const showSkip = canDismissBasics(initial);

  useEffect(() => {
    setName(initial.name);
    setCityId(initial.cityId);
    setCityName(initial.cityName);
    setSecondaryDone(initial.needSecondary === null);
    setPhase("details");
  }, [initial]);

  async function onCityQueryChange(value: string) {
    setCityQuery(value);
    setCityNoResults(false);
    if (value.trim().length < MIN_CITY_QUERY) {
      setCityResults([]);
      return;
    }
    const results = await fetchCities(value.trim()).catch(() => []);
    setCityResults(results);
    setCityNoResults(results.length === 0);
  }

  function selectCity(city: City) {
    setCityId(city.id);
    setCityName(city.name);
    setSelectedCity(city);
    setCityQuery("");
    setCityResults([]);
    setCityNoResults(false);
  }

  function clearCity() {
    setCityId(null);
    setCityName(null);
    setSelectedCity(null);
    setCityQuery("");
    setCityResults([]);
  }

  async function saveNameAndCity(): Promise<boolean> {
    try {
      await updateProfile(accessToken, {
        name: name.trim(),
        ...(cityId ? { cityId } : {}),
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      return false;
    }
  }

  async function finish() {
    setPending(true);
    setError(null);
    const ok = await saveNameAndCity();
    setPending(false);
    if (!ok) return;
    onSaved({
      ...initial,
      name: name.trim(),
      cityId,
      cityName,
      needSecondary: null,
      city: selectedCity,
    });
  }

  async function onContinueDetails() {
    if (!nameOk) {
      setError("Please enter your name");
      return;
    }
    setPending(true);
    setError(null);
    const ok = await saveNameAndCity();
    setPending(false);
    if (!ok) return;

    if (!secondaryDone && initial.needSecondary === "phone") {
      setPhase("askPhone");
      return;
    }
    if (!secondaryDone && initial.needSecondary === "email") {
      setPhase("askEmail");
      return;
    }
    await finish();
  }

  function handleLinkResult(result: LinkIdentifierResult) {
    if (result.status === "confirm") {
      setMergeSummary(result.summary);
      setPhase("confirmMerge");
      return;
    }
    if (result.status === "merged" && result.reauthRequired) {
      onReauthRequired();
      return;
    }
    setSecondaryDone(true);
    setPhase("details");
    void finish();
  }

  function errMessage(e: unknown, fallback: string): string {
    if (e instanceof BffError) return e.message;
    if (e instanceof Error) return e.message;
    return fallback;
  }

  async function onSendLinkOtp() {
    setPending(true);
    setError(null);
    try {
      await sendOtp(phoneDigits.trim());
      setPhase("askOtp");
    } catch (e) {
      setError(errMessage(e, "Couldn't send the OTP"));
    } finally {
      setPending(false);
    }
  }

  async function onVerifyLinkOtp() {
    setPending(true);
    setError(null);
    try {
      const result = await linkPhone(accessToken, phoneDigits.trim(), otp.trim());
      handleLinkResult(result);
    } catch (e) {
      setError(errMessage(e, "Couldn't verify phone"));
    } finally {
      setPending(false);
    }
  }

  async function onSendEmailCode() {
    setPending(true);
    setError(null);
    try {
      await requestEmailCode(accessToken, email.trim());
      setPhase("askEmailCode");
    } catch (e) {
      setError(errMessage(e, "Couldn't send the code"));
    } finally {
      setPending(false);
    }
  }

  async function onVerifyEmailCode() {
    setPending(true);
    setError(null);
    try {
      const result = await verifyEmail(accessToken, email.trim(), emailCode.trim());
      handleLinkResult(result);
    } catch (e) {
      setError(errMessage(e, "Couldn't verify email"));
    } finally {
      setPending(false);
    }
  }

  async function onConfirmMerge() {
    setPending(true);
    setError(null);
    try {
      await confirmAccountMerge(
        accessToken,
        initial.needSecondary === "phone"
          ? { phone: phoneDigits.trim(), code: otp.trim() }
          : { email: email.trim(), code: emailCode.trim() },
      );
      onReauthRequired();
    } catch (e) {
      setError(errMessage(e, "Couldn't merge the accounts"));
    } finally {
      setPending(false);
    }
  }

  if (phase === "confirmMerge" && mergeSummary) {
    const want = initial.needSecondary === "phone" ? "phone" : "email";
    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>That {want} is already registered</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          It's on another account with{" "}
          {[
            mergeSummary.listings && `${mergeSummary.listings} listing${mergeSummary.listings === 1 ? "" : "s"}`,
            mergeSummary.conversations &&
              `${mergeSummary.conversations} conversation${mergeSummary.conversations === 1 ? "" : "s"}`,
            mergeSummary.payments && `${mergeSummary.payments} payment${mergeSummary.payments === 1 ? "" : "s"}`,
            mergeSummary.favourites && `${mergeSummary.favourites} saved`,
            mergeSummary.activeSubscription && "an active plan",
          ]
            .filter(Boolean)
            .join(", ") || "some activity"}
          . Merging brings it all onto one account.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onConfirmMerge()}
          disabled={pending}
          style={[styles.primaryButton, { backgroundColor: colors.green, opacity: pending ? 0.5 : 1 }]}
        >
          {pending ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Merge the accounts</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            setError(null);
            setMergeSummary(null);
            setPhase(want === "phone" ? "askPhone" : "askEmail");
          }}
          disabled={pending}
          style={{ marginTop: 10, alignItems: "center" }}
        >
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Use a different {want}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "askPhone") {
    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Verify your phone</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Add a phone number and verify it with OTP so buyers can reach you and you can sign in by
          phone later.
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 9,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>+91</Text>
          </View>
          <BottomSheetTextInput
            value={phoneDigits}
            onChangeText={(v) => setPhoneDigits(v.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit mobile number"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            ref={focusAfterSheetSettles}
            style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onSendLinkOtp()}
          disabled={pending || phoneDigits.length !== 10}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.green, opacity: pending || phoneDigits.length !== 10 ? 0.5 : 1 },
          ]}
        >
          {pending ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Send OTP</Text>
          )}
        </Pressable>
        {/* Vector chevron, not a "←" glyph — a Unicode arrow renders as a stray character on
            Android fonts that lack it (same fix as the login sheet's own Back button). */}
        <Pressable
          onPress={() => setPhase("details")}
          disabled={pending}
          style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}
        >
          <Icon name="chevronLeft" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "askOtp") {
    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Enter the OTP</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>Sent to +91 {phoneDigits}.</Text>
        <BottomSheetTextInput
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
          placeholder="······"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          ref={focusAfterSheetSettles}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, textAlign: "center", letterSpacing: 8 }]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onVerifyLinkOtp()}
          disabled={pending || otp.length !== 6}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.green, opacity: pending || otp.length !== 6 ? 0.5 : 1, marginTop: 12 },
          ]}
        >
          {pending ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Verify phone</Text>
          )}
        </Pressable>
        <Pressable onPress={() => setPhase("askPhone")} disabled={pending} style={{ marginTop: 10, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Change number</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "askEmail") {
    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Add an email and verify it with a code so we can reach you about your ads — and so Google
          sign-in later returns you to this account.
        </Text>
        <BottomSheetTextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          ref={focusAfterSheetSettles}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onSendEmailCode()}
          disabled={pending || !email.includes("@")}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.green, opacity: pending || !email.includes("@") ? 0.5 : 1, marginTop: 12 },
          ]}
        >
          {pending ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Send code</Text>
          )}
        </Pressable>
        {/* Vector chevron, not a "←" glyph — a Unicode arrow renders as a stray character on
            Android fonts that lack it (same fix as the login sheet's own Back button). */}
        <Pressable
          onPress={() => setPhase("details")}
          disabled={pending}
          style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}
        >
          <Icon name="chevronLeft" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "askEmailCode") {
    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Confirm your email</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>We sent a 6-digit code to {email}.</Text>
        <BottomSheetTextInput
          value={emailCode}
          onChangeText={(v) => setEmailCode(v.replace(/\D/g, "").slice(0, 6))}
          placeholder="······"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          ref={focusAfterSheetSettles}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, textAlign: "center", letterSpacing: 8 }]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onVerifyEmailCode()}
          disabled={pending || emailCode.length !== 6}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.green, opacity: pending || emailCode.length !== 6 ? 0.5 : 1, marginTop: 12 },
          ]}
        >
          {pending ? (
            <ActivityIndicator color={colors.onGreen} />
          ) : (
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Verify email</Text>
          )}
        </Pressable>
        <Pressable onPress={() => setPhase("askEmail")} disabled={pending} style={{ marginTop: 10, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Change email</Text>
        </Pressable>
      </View>
    );
  }

  const continueLabel = !secondaryDone
    ? initial.needSecondary === "phone"
      ? "Continue to verify phone"
      : "Continue to verify email"
    : "Continue";

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>Complete your profile</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Sellers and buyers see your name in messages.
        {!secondaryDone && initial.needSecondary === "phone" ? " You'll verify a phone number next." : ""}
        {!secondaryDone && initial.needSecondary === "email" ? " You'll verify an email next." : ""} Preferred
        city is optional — you can skip it once your name and{" "}
        {initial.needSecondary === "phone" ? "phone" : initial.needSecondary === "email" ? "email" : "details"}{" "}
        are set.
      </Text>

      <Text style={[styles.label, { color: colors.muted }]}>Name</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.muted}
        ref={initial.name.trim() ? undefined : focusAfterSheetSettles}
        maxLength={80}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.muted, marginTop: 14 }]}>
        Preferred city <Text style={{ fontWeight: "400" }}>(optional)</Text>
      </Text>
      {cityName && !cityQuery ? (
        <View style={[styles.pickedRow, { borderColor: colors.border }]}>
          <Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: colors.text }}>{cityName}</Text>
          <Pressable onPress={clearCity}>
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <BottomSheetTextInput
            value={cityQuery}
            onChangeText={(v) => void onCityQueryChange(v)}
            placeholder="Start typing your city…"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          {cityQuery.trim().length > 0 && cityQuery.trim().length < MIN_CITY_QUERY && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              Type at least {MIN_CITY_QUERY} characters to search.
            </Text>
          )}
          {cityNoResults && (
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
              No cities match — try another spelling.
            </Text>
          )}
          {cityResults.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => selectCity(c)}
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{c.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>{c.state}</Text>
            </Pressable>
          ))}
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => void onContinueDetails()}
        disabled={pending || !nameOk}
        style={[
          styles.primaryButton,
          { backgroundColor: colors.green, opacity: pending || !nameOk ? 0.5 : 1, marginTop: 16 },
        ]}
      >
        {pending ? (
          <ActivityIndicator color={colors.onGreen} />
        ) : (
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{continueLabel}</Text>
        )}
      </Pressable>

      {showSkip && (
        <Pressable onPress={onSkip} disabled={pending} style={{ marginTop: 10, alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Skip city for now</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: "700", fontSize: 19, marginBottom: 8 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  label: { fontSize: 11.5, fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  primaryButton: {
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  error: { color: "#b3413a", fontSize: 13, marginTop: 10 },
});
