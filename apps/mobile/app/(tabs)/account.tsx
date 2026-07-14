import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";

export default function AccountScreen() {
  const { colors } = useAppTheme();
  const { requireLogin, isLoggedIn } = useHomeSheets();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
    }, [isLoggedIn, requireLogin]),
  );

  if (!isLoggedIn) {
    return <View style={[styles.container, { backgroundColor: colors.bg }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 20 }}>Your account</Text>
      <Pressable onPress={() => router.push("/messages")} style={[styles.row, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>💬 Messages</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24 },
});
