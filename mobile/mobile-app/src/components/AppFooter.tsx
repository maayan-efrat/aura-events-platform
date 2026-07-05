import { StyleSheet, Text, View } from "react-native";

/** Persistent bottom bar shown on every screen. */
export function AppFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>AuraEvents © 2026</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "#09090b",
    borderTopWidth: 1,
    borderTopColor: "#18181b",
  },
  footerText: { fontSize: 11, color: "#52525b" },
});
