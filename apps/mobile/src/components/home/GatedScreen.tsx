import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";

export function GatedScreen({ title }: { title: string }) {
  const { colors } = useAppTheme();
  const { requireLogin, isLoggedIn } = useHomeSheets();

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) requireLogin();
    }, [isLoggedIn, requireLogin]),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {isLoggedIn && <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
