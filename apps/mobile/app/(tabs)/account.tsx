import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { UserProfileDto } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { linkPhone, sendOtp, updateProfile } from "../../src/lib/bffClient";

type PhoneStep = "idle" | "otpSent";

export default function AccountScreen() {
  const { colors } = useAppTheme();
  const { requireLogin, isLoggedIn, accessToken, profile, refreshProfile } = useHomeSheets();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
    }, [isLoggedIn, requireLogin]),
  );

  if (!isLoggedIn) {
    return <View style={[styles.container, { backgroundColor: colors.bg }]} />;
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
    />
  );
}

function ProfileFields({
  accessToken,
  profile,
  refreshProfile,
  onOpenMessages,
}: {
  accessToken: string;
  profile: UserProfileDto;
  refreshProfile: () => Promise<void>;
  onOpenMessages: () => void;
}) {
  const { colors } = useAppTheme();

  const [name, setName] = useState(profile.name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  const [phonePending, setPhonePending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const emailMissing = !profile.email && email.trim().length === 0;
  const canSave = !!profile.phone && !emailMissing;

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
      await linkPhone(accessToken, phoneInput, otpInput);
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
      await updateProfile(accessToken, {
        name: name.trim() || undefined,
        email: !profile.email && email.trim() ? email.trim() : undefined,
      });
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
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
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
  errorText: { color: "#c0554b", fontSize: 13, marginBottom: 8 },
});
