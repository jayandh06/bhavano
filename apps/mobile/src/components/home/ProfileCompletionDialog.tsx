import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { usePathname } from "expo-router";
import type { AccountMergeSummary, LinkIdentifierResult } from "@bhavano/types";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { useAppTheme } from "../../theme/ThemeContext";
import {
  confirmAccountMerge,
  fetchProfileNudge,
  linkPhone,
  requestEmailCode,
  sendOtp,
  snoozeProfileNudge,
  verifyEmail,
} from "../../lib/bffClient";
import { Icon } from "../Icon";

type Step = "askPhone" | "askOtp" | "askEmail" | "askEmailCode" | "confirmMerge" | "done";

/** Shown at most once per app launch — the gate effect below can re-fire on every navigation, but
 * `getProfileNudge`'s own snooze/cap is the real backstop against over-showing across launches;
 * this flag only stops a second popup within the *same* one. */
let shownThisLaunch = false;

/**
 * Mobile port of apps/web/src/components/home/ProfileCompletionDialog.tsx — same state machine,
 * same BFF endpoints (`GET /users/me/profile-nudge`, the email/phone link + merge-confirm routes),
 * same three-way link-result branch. See docs/plans/
 * owner-win-back-notifications-and-mobile-email-capture.md (Part B): phone-only signups, the
 * common case on this platform, have no email on file at all, so the posted-ad reminder and
 * activity digest can only reach them by WhatsApp without this.
 *
 * Only ever asks on a RETURN login (`!isNewUser`), never the login that just created the account,
 * and only once per launch, after the first navigation past mount. A session restored from
 * SecureStore on relaunch has no persisted `isNewUser` (see HomeSheetsProvider's own doc comment
 * on that field) — it defaults to false, so a cold start is always treated as a return visit;
 * the BFF's own cap/snooze is what keeps that from nagging.
 */
export function ProfileCompletionDialog() {
  const { accessToken, isLoggedIn, isNewUser, refreshProfile, logout } = useHomeSheets();
  const { colors } = useAppTheme();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [want, setWant] = useState<"email" | "phone">("phone");
  const [step, setStep] = useState<Step>("askPhone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeSummary, setMergeSummary] = useState<AccountMergeSummary | null>(null);

  const initialPath = useRef(pathname);
  const checkedRef = useRef(false);
  useEffect(() => {
    if (checkedRef.current || pathname === initialPath.current) return;
    checkedRef.current = true;
    if (shownThisLaunch || !isLoggedIn || isNewUser || !accessToken) return;
    let cancelled = false;
    (async () => {
      const nudge = await fetchProfileNudge(accessToken).catch(() => ({ show: false, missing: [] as ("email" | "phone")[] }));
      if (cancelled || !nudge.show || nudge.missing.length === 0) return;
      shownThisLaunch = true;
      const target = nudge.missing.includes("phone") ? "phone" : "email";
      setWant(target);
      setStep(target === "phone" ? "askPhone" : "askEmail");
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, isLoggedIn, isNewUser, accessToken]);

  function dismiss() {
    setOpen(false);
    if (accessToken) void snoozeProfileNudge(accessToken);
  }

  function succeed(reauthRequired = false) {
    setStep("done");
    setOpen(false);
    if (reauthRequired) void logout();
    else void refreshProfile();
  }

  function handleLinkResult(result: LinkIdentifierResult) {
    if (result.status === "confirm") {
      setMergeSummary(result.summary);
      setStep("confirmMerge");
      return;
    }
    succeed(result.status === "merged" && result.reauthRequired);
  }

  async function onSendOtp() {
    setPending(true);
    setError(null);
    try {
      await sendOtp(phone.trim());
      setStep("askOtp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the OTP");
    } finally {
      setPending(false);
    }
  }

  async function onVerifyOtp() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      handleLinkResult(await linkPhone(accessToken, phone.trim(), otp.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify the OTP");
    } finally {
      setPending(false);
    }
  }

  async function onSendEmailCode() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      await requestEmailCode(accessToken, email.trim());
      setStep("askEmailCode");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code");
    } finally {
      setPending(false);
    }
  }

  async function onVerifyEmailCode() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      handleLinkResult(await verifyEmail(accessToken, email.trim(), code.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify the code");
    } finally {
      setPending(false);
    }
  }

  async function onConfirmMerge() {
    if (!accessToken) return;
    setPending(true);
    setError(null);
    try {
      await confirmAccountMerge(
        accessToken,
        want === "phone" ? { phone: phone.trim(), code: otp.trim() } : { email: email.trim(), code: code.trim() },
      );
      // A merge can retire the current account; safest to re-authenticate.
      succeed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't merge the accounts");
      setPending(false);
    }
  }

  if (!open) return null;

  const title =
    step === "confirmMerge"
      ? `That ${want} is already registered`
      : want === "phone"
        ? "Add your phone number"
        : "Add your email";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000066", alignItems: "center", justifyContent: "center", padding: 20 }}
        onPress={dismiss}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 400, backgroundColor: colors.surface, borderRadius: 16, padding: 20 }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 19, color: colors.text, flex: 1 }}>{title}</Text>
            <Pressable onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>

          {step !== "confirmMerge" && (
            <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 16 }}>
              {want === "phone"
                ? "So buyers can reach you about your listings, and we can text you when someone's interested."
                : "So we can email you a copy of your listings and updates about your account."}
            </Text>
          )}

          {step === "askPhone" && (
            <>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                style={[inputStyle, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />
              {error && <Text style={errorStyle}>{error}</Text>}
              <Pressable
                onPress={onSendOtp}
                disabled={pending || phone.trim().length < 10}
                style={[primaryButtonStyle, { backgroundColor: colors.green, opacity: pending || phone.trim().length < 10 ? 0.5 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{pending ? "Sending…" : "Send OTP"}</Text>
              </Pressable>
              <Pressable onPress={dismiss} disabled={pending} style={ghostButtonStyle}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Not now</Text>
              </Pressable>
            </>
          )}

          {step === "askOtp" && (
            <>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                placeholder="6-digit OTP"
                placeholderTextColor={colors.muted}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                style={[
                  inputStyle,
                  { textAlign: "center", letterSpacing: 8, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                ]}
              />
              {error && <Text style={errorStyle}>{error}</Text>}
              <Pressable
                onPress={onVerifyOtp}
                disabled={pending || otp.trim().length < 4}
                style={[primaryButtonStyle, { backgroundColor: colors.green, opacity: pending || otp.trim().length < 4 ? 0.5 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{pending ? "Verifying…" : "Verify & add"}</Text>
              </Pressable>
              <Pressable onPress={() => setStep("askPhone")} disabled={pending} style={ghostButtonStyle}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Change number</Text>
              </Pressable>
            </>
          )}

          {step === "askEmail" && (
            <>
              <TextInput
                autoFocus
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                style={[inputStyle, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />
              {error && <Text style={errorStyle}>{error}</Text>}
              <Pressable
                onPress={onSendEmailCode}
                disabled={pending || !email.includes("@")}
                style={[primaryButtonStyle, { backgroundColor: colors.green, opacity: pending || !email.includes("@") ? 0.5 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{pending ? "Sending…" : "Send code"}</Text>
              </Pressable>
              <Pressable onPress={dismiss} disabled={pending} style={ghostButtonStyle}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Not now</Text>
              </Pressable>
            </>
          )}

          {step === "askEmailCode" && (
            <>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                placeholder="6-digit code"
                placeholderTextColor={colors.muted}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                style={[
                  inputStyle,
                  { textAlign: "center", letterSpacing: 8, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
                ]}
              />
              {error && <Text style={errorStyle}>{error}</Text>}
              <Pressable
                onPress={onVerifyEmailCode}
                disabled={pending || code.trim().length < 4}
                style={[primaryButtonStyle, { backgroundColor: colors.green, opacity: pending || code.trim().length < 4 ? 0.5 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{pending ? "Verifying…" : "Verify & add"}</Text>
              </Pressable>
              <Pressable onPress={() => setStep("askEmail")} disabled={pending} style={ghostButtonStyle}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Change email</Text>
              </Pressable>
            </>
          )}

          {step === "confirmMerge" && mergeSummary && (
            <>
              <Text style={{ fontSize: 13, color: colors.textSoft, lineHeight: 19, marginBottom: 12 }}>
                It&apos;s on another account with{" "}
                {[
                  mergeSummary.listings && `${mergeSummary.listings} listing${mergeSummary.listings === 1 ? "" : "s"}`,
                  mergeSummary.conversations && `${mergeSummary.conversations} conversation${mergeSummary.conversations === 1 ? "" : "s"}`,
                  mergeSummary.payments && `${mergeSummary.payments} payment${mergeSummary.payments === 1 ? "" : "s"}`,
                  mergeSummary.favourites && `${mergeSummary.favourites} saved`,
                  mergeSummary.activeSubscription && "an active plan",
                ]
                  .filter(Boolean)
                  .join(", ") || "some activity"}
                . Merging brings it all onto one account.
              </Text>
              {error && <Text style={[errorStyle, { marginBottom: 8 }]}>{error}</Text>}
              <Pressable
                onPress={onConfirmMerge}
                disabled={pending}
                style={[primaryButtonStyle, { backgroundColor: colors.green, opacity: pending ? 0.5 : 1 }]}
              >
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{pending ? "Merging…" : "Merge the accounts"}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setError(null);
                  setMergeSummary(null);
                  setStep(want === "phone" ? "askPhone" : "askEmail");
                }}
                disabled={pending}
                style={ghostButtonStyle}
              >
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Use a different {want}</Text>
              </Pressable>
              <Pressable onPress={dismiss} disabled={pending} style={ghostButtonStyle}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 13 }}>Not now</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1.5,
  borderRadius: 9,
  paddingVertical: 12,
  paddingHorizontal: 14,
  fontSize: 14,
  marginBottom: 14,
} as const;

const primaryButtonStyle = {
  borderRadius: 8,
  paddingVertical: 13,
  alignItems: "center",
  marginTop: 2,
} as const;

const ghostButtonStyle = {
  alignItems: "center",
  paddingVertical: 10,
  marginTop: 4,
} as const;

const errorStyle = { color: "#c0554b", fontSize: 13, marginTop: 6, marginBottom: 0 } as const;
