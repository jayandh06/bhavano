import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { UserProfileDto } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { LegalFooter } from "../../src/components/home/LegalFooter";
import {
  linkPhone,
  requestEmailCode,
  sendOtp,
  updateProfile,
  verifyEmail,
} from "../../src/lib/bffClient";

type PhoneStep = "idle" | "otpSent";

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

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
    }, [isLoggedIn, requireLogin]),
  );

  if (!isLoggedIn) {
    // The login sheet is what's actually on screen here, but the entity disclosure has to be
    // reachable *without* an account — a verification reviewer won't sign up to find it.
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scrollContent}>
        <LegalFooter />
      </ScrollView>
    );
  }

  if (!profile || !accessToken) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <ProfileFields
      accessToken={accessToken}
      profile={profile}
      refreshProfile={refreshProfile}
      onOpenMessages={() => router.push("/messages")}
      onLogout={onLogout}
      loggingOut={loggingOut}
    />
  );
}

function ProfileFields({
  accessToken,
  profile,
  refreshProfile,
  onOpenMessages,
  onLogout,
  loggingOut,
}: {
  accessToken: string;
  profile: UserProfileDto;
  refreshProfile: () => Promise<void>;
  onOpenMessages: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const { colors, theme, toggleTheme } = useAppTheme();

  const [name, setName] = useState(profile.name ?? "");
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

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      // No email here: an address only reaches the profile through the verified flow below,
      // mirroring how a phone only arrives through OTP. See
      // docs/plans/account-linking-phone-and-email.md.
      await updateProfile(accessToken, { name: name.trim() || undefined });
      await refreshProfile();
      setMessage({ type: "success", text: "Profile updated." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.scrollContent}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 20 }}>Your account</Text>

      <Pressable onPress={onOpenMessages} style={[styles.row, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>💬 Messages</Text>
      </Pressable>

      {/* The other toggle lives in the Home tab's brand row, which is not where anyone looks for
          a preference — and is unreachable from the other three tabs. Appearance belongs on the
          settings screen; Home keeps its copy for the visitor who spots it there first. */}
      <Pressable onPress={toggleTheme} style={[styles.row, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
          {theme === "dark" ? "☀️  Switch to light mode" : "🌙  Switch to dark mode"}
        </Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>

      <Text style={[styles.label, { color: colors.muted }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={colors.muted}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
      />

      <Text style={[styles.label, { color: colors.muted }]}>
        Email{!profile.email ? " *" : ""}
      </Text>
      {profile.email ? (
        <View style={[styles.readOnly, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ color: colors.textSoft, fontSize: 14 }}>{profile.email}</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.muted }]}>
            You signed in with your phone number — add an email so we have another way to reach you.
          </Text>
          {emailStep === "idle" ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />
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
                >
                  <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13, marginTop: 14 }}>← Back</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  row: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignSelf: "flex-start", marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 16, textTransform: "uppercase", letterSpacing: 0.3 },
  hint: { fontSize: 12.5, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, marginBottom: 4 },
  readOnly: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14 },
  countryChip: { borderWidth: 1, borderRadius: 9, paddingVertical: 12, paddingHorizontal: 14, justifyContent: "center" },
  secondaryButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", alignSelf: "flex-start" },
  primaryButton: { borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 24 },
  logoutButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 32 },
  errorText: { color: "#c0554b", fontSize: 13, marginBottom: 8 },
});
