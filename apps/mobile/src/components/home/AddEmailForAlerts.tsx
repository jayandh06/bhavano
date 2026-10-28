import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";
import { requestEmailCode, verifyEmail } from "../../lib/bffClient";

/** Adds a verified email without leaving the screen: the free way to be alerted for someone who signed in with a mobile number only. Same two steps and server
 * checks as the profile's email link. If the address already belongs to another Bhavano account, linking them needs the approval step in the profile, so this
 * points there instead of merging anything itself. Mirrors the website's AddEmailForAlerts. */
export function AddEmailForAlerts({ accessToken, onAdded }: { accessToken: string; onAdded: () => void }) {
  const { colors } = useAppTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setPending(true);
    setError(null);
    try {
      await requestEmailCode(accessToken, email.trim());
      setPhase("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code");
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    setPending(true);
    setError(null);
    try {
      const result = await verifyEmail(accessToken, email.trim(), code.trim());
      if (result.status === "linked") onAdded();
      else setError("This email is already on another Bhavano account. Open your profile and add it there to link the two accounts.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify the code");
    } finally {
      setPending(false);
    }
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = !pending && (phase === "email" ? validEmail : code.trim().length === 6);

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Add your email to get free alerts</Text>
      {phase === "email" ? (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
      ) : (
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="6-digit code"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
        <Pressable
          disabled={!canSubmit}
          onPress={() => void (phase === "email" ? sendCode() : verify())}
          style={[styles.button, { backgroundColor: colors.green, opacity: canSubmit ? 1 : 0.6 }]}
        >
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>
            {pending ? "Please wait…" : phase === "email" ? "Send code" : "Verify"}
          </Text>
        </Pressable>
        {phase === "code" && (
          <Pressable onPress={() => setPhase("email")}>
            <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: "underline" }}>Change email</Text>
          </Pressable>
        )}
      </View>
      {error && <Text style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  button: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
});
