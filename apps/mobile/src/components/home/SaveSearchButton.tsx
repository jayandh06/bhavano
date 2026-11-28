import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import type { CreateSavedSearchInput } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { BffError, createSavedSearch } from "../../lib/bffClient";
import { useMarket } from "../../lib/market";

/**
 * "Save this search" in the home screen's filter row — mobile counterpart to the website's
 * SaveSearchButton. Renders nothing until the two mandatory fields (city, a full price range) are
 * set, matching the website's rule; a tap then asks only for a name, since everything else is
 * already in the filters on screen. Logged-out users are sent to login first.
 */
export function SaveSearchButton({ criteria }: { criteria: Omit<CreateSavedSearchInput, "name"> }) {
  const { colors } = useAppTheme();
  const market = useMarket();
  const router = useRouter();
  const { accessToken, requireLogin } = useHomeSheets();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!criteria.cityId || criteria.minPrice === undefined || criteria.maxPrice === undefined) return null;

  function onOpen() {
    setError(null);
    setSaved(false);
    if (!accessToken) {
      requireLogin();
      return;
    }
    setOpen(true);
  }

  async function onSave() {
    if (!accessToken) return;
    if (!name.trim()) {
      setError("Give this saved search a name.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createSavedSearch(accessToken, { name: name.trim(), ...criteria });
      setName("");
      setSaved(true);
    } catch (e) {
      // 402/403 is the BFF saying the free alerts are used up and there is no Plus subscription.
      if (e instanceof BffError && (e.status === 402 || e.status === 403)) {
        setError("You've used your free saved search alerts. Get Bhavano Plus for unlimited alerts.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't save this search");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Save this search"
        style={[styles.pill, { backgroundColor: colors.surfaceAlt, borderColor: saved ? colors.green : colors.border }]}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: saved ? colors.green : colors.text }} numberOfLines={1}>
          {saved ? "Saved" : "Save search"}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {saved ? (
              <>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>✓ Search saved</Text>
                <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>
                  We&rsquo;ll alert you the moment a new listing matches.
                </Text>
                <View style={styles.row}>
                  <Pressable
                    onPress={() => {
                      setOpen(false);
                      router.push("/saved-searches");
                    }}
                  >
                    <Text style={{ color: colors.green, fontWeight: "700", fontSize: 14 }}>View saved searches</Text>
                  </Pressable>
                  <Pressable onPress={() => setOpen(false)} style={{ marginLeft: "auto" }}>
                    <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 14 }}>Done</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Name this search</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={() => void onSave()}
                  placeholder={market.id === "us" ? "e.g. 2 bed in Austin" : "e.g. 2BHK in Koramangala"}
                  placeholderTextColor={colors.muted}
                  autoFocus
                  maxLength={80}
                  returnKeyType="done"
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
                />
                {error && <Text style={{ color: "#c0554b", fontSize: 12.5, marginTop: 8 }}>{error}</Text>}
                <View style={styles.row}>
                  <Pressable onPress={() => setOpen(false)} disabled={pending}>
                    <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onSave()}
                    disabled={pending}
                    style={[styles.saveButton, { backgroundColor: colors.green, opacity: pending ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>
                      {pending ? "Saving…" : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  backdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderWidth: 1, borderRadius: 14, padding: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 16 },
  saveButton: { marginLeft: "auto", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 22 },
});
