import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { RequirementDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import {
  closeMyRequirement,
  renewMyRequirement,
  updateMyRequirement,
} from "../../lib/bffClient";

/** How far ahead of expiry the Renew affordance appears — same 7-day window as a listing's, so
 * the two pages behave alike. */
const RENEW_WINDOW_DAYS = 7;

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Mobile counterpart to web's `MyRequirementCard` — Phase 1 of
 * docs/plans/property-requirements-demand-side.md. Same renew / close / optional note+timeline
 * controls; date is typed as YYYY-MM-DD rather than a native date picker so we stay dependency-
 * free and match the ISO slice the BFF already accepts.
 */
export function MyRequirementCard({
  requirement,
  accessToken,
}: {
  requirement: RequirementDto;
  accessToken: string;
}) {
  const { colors } = useAppTheme();
  const [current, setCurrent] = useState(requirement);
  const [note, setNote] = useState(requirement.note ?? "");
  const [moveInBy, setMoveInBy] = useState(requirement.moveInBy?.slice(0, 10) ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDetails, setSavedDetails] = useState(false);

  const closed = current.status === "closed";
  const expiringSoon = !closed && !current.isExpired && daysUntil(current.expiresAt) <= RENEW_WINDOW_DAYS;

  async function run(key: string, action: () => Promise<RequirementDto>) {
    setPending(key);
    setError(null);
    setSavedDetails(false);
    try {
      const next = await action();
      setCurrent(next);
      if (key === "details") setSavedDetails(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work — try again");
    } finally {
      setPending(null);
    }
  }

  const statusLine = closed
    ? current.closedReason === "fulfilled"
      ? "Closed — you found something"
      : current.closedReason === "withdrawn"
        ? "Withdrawn"
        : current.closedReason === "expired"
          ? "Expired — renew to start it again"
          : "Closed"
    : current.isExpired
      ? "Expired — renew to start it again"
      : `Active until ${dateFormatter.format(new Date(current.expiresAt))}`;

  const meta = [
    current.areaName ?? current.cityName,
    current.bedrooms ? `${current.bedrooms} BHK` : null,
    current.maxPrice ? `up to ₹${current.maxPrice.toLocaleString("en-IN")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.text }}>
            {current.searchLabel}
          </Text>
          {meta ? (
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>{meta}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", maxWidth: "42%" }}>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: "700",
              color: closed || current.isExpired ? colors.muted : colors.green,
              textAlign: "right",
            }}
          >
            {statusLine}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4, textAlign: "right" }}>
            {current.hasAlert ? "We'll alert you on new matches" : "No alert — our team follows up"}
          </Text>
        </View>
      </View>

      {!closed && (
        <View style={[styles.section, { borderTopColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Anything else we should know?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ground floor, close to a metro station, pet friendly…"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Needed by (YYYY-MM-DD)</Text>
          <TextInput
            value={moveInBy}
            onChangeText={setMoveInBy}
            placeholder="2026-10-01"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Pressable
              disabled={pending !== null}
              onPress={() =>
                void run("details", () =>
                  updateMyRequirement(accessToken, current.id, {
                    note: note.trim() || undefined,
                    moveInBy: moveInBy ? new Date(moveInBy).toISOString() : undefined,
                  }),
                )
              }
              style={[styles.primaryButton, { backgroundColor: colors.green, opacity: pending !== null ? 0.6 : 1 }]}
            >
              {pending === "details" ? (
                <ActivityIndicator color={colors.onGreen} />
              ) : (
                <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>Save details</Text>
              )}
            </Pressable>
            {savedDetails && (
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Saved</Text>
            )}
          </View>
        </View>
      )}

      <View style={[styles.section, { borderTopColor: colors.border, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }]}>
        {(expiringSoon || current.isExpired || current.closedReason === "expired") && (
          <Pressable
            disabled={pending !== null}
            onPress={() => void run("renew", () => renewMyRequirement(accessToken, current.id))}
            style={[styles.primaryButton, { backgroundColor: colors.green, opacity: pending !== null ? 0.6 : 1 }]}
          >
            {pending === "renew" ? (
              <ActivityIndicator color={colors.onGreen} />
            ) : (
              <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 13 }}>Renew for 30 days</Text>
            )}
          </Pressable>
        )}
        {!closed && (
          <>
            <Pressable
              disabled={pending !== null}
              onPress={() => void run("fulfilled", () => closeMyRequirement(accessToken, current.id, "fulfilled"))}
              style={[styles.outlineButton, { borderColor: colors.border, opacity: pending !== null ? 0.6 : 1 }]}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                {pending === "fulfilled" ? "Saving…" : "I found something"}
              </Text>
            </Pressable>
            <Pressable
              disabled={pending !== null}
              onPress={() => void run("withdrawn", () => closeMyRequirement(accessToken, current.id, "withdrawn"))}
            >
              <Text style={{ color: colors.muted, fontSize: 13, textDecorationLine: "underline" }}>
                {pending === "withdrawn" ? "Withdrawing…" : "No longer looking"}
              </Text>
            </Pressable>
          </>
        )}
        {error ? <Text style={{ color: "#c0554b", fontSize: 12.5 }}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  section: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13.5 },
  primaryButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", minWidth: 110 },
  outlineButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
});
