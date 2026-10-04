import { forwardRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { MESSAGE_MAX_LENGTH, MESSAGE_MIN_LENGTH, type ContactTopic } from "@bhavano/types/support";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { submitSupportTicket } from "../../lib/bffClient";

/**
 * Reports a listing or a conversation's other party, via the same support-ticket pipeline the
 * website's Contact Us form posts to (see docs/plans/contact-us-support-form.md) — the mobile
 * app's own ticket submission, not a second system. Added for Apple App Review's Guideline 1.2
 * requirement that UGC apps have a reporting mechanism — see
 * docs/plans/ios-app-store-release.md.
 *
 * There is no dedicated "report a message" column on the ticket: `context` (the listing's own
 * URL, or a line naming the conversation) rides along inside the free-text message instead,
 * same as every other support topic.
 */
export const ReportSheet = forwardRef<
  BottomSheetModal,
  {
    topic: ContactTopic;
    /** Shown above the message box so the reporter knows what they're reporting — also sent as
     * the first line of the ticket's message body. */
    context: string;
    /** Only for `listing_report` — the ticket's own `listingUrl` field, separate from `context`. */
    listingUrl?: string;
  }
>(function ReportSheet({ topic, context, listingUrl }, ref) {
  const { colors } = useAppTheme();
  const { profile, requireLogin } = useHomeSheets();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = message.trim().length >= MESSAGE_MIN_LENGTH && !submitting;

  async function onSubmit() {
    if (!profile) {
      requireLogin();
      return;
    }
    // A phone-only account has no email on file at all — the ticket endpoint requires one so
    // support has somewhere to reply. Falling back to a fixed, recognisable placeholder rather
    // than blocking the report entirely; support still has the account's phone via userId.
    const email = profile.email ?? "no-email-on-file@bhavano.com";
    setSubmitting(true);
    setError(null);
    try {
      await submitSupportTicket({
        topic,
        name: profile.name ?? "Bhavano user",
        email,
        phone: profile.phone ?? undefined,
        listingUrl,
        message: `${context}\n\n${message.trim()}`,
        userId: profile.id,
      });
      setDone(true);
      setMessage("");
    } catch {
      setError("Couldn't send your report — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["55%"]}
      backgroundStyle={{ backgroundColor: colors.surface }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={() => {
        setDone(false);
        setError(null);
      }}
    >
      <BottomSheetView style={styles.content}>
        {done ? (
          <View style={styles.doneState}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Report sent
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 6 }}>
              Our team will take a look. Thanks for flagging it.
            </Text>
          </View>
        ) : (
          <>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Report</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, marginBottom: 12 }} numberOfLines={2}>
              {context}
            </Text>
            <Text style={[styles.label, { color: colors.textSoft }]}>What's wrong?</Text>
            <BottomSheetTextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the issue — the more detail, the faster we can act."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={MESSAGE_MAX_LENGTH}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }]}
            />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              {message.trim().length}/{MESSAGE_MIN_LENGTH} characters minimum
            </Text>
            {error && <Text style={{ color: "#b3413a", fontSize: 13, marginTop: 8 }}>{error}</Text>}
            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={[styles.submitButton, { backgroundColor: canSubmit ? colors.green : colors.border }]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onGreen} />
              ) : (
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Submit report</Text>
              )}
            </Pressable>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { padding: 20, flex: 1 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 110, textAlignVertical: "top" },
  submitButton: { borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 16 },
  doneState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
});
