import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AuraUser } from "../lib/auth";

/** Persistent top bar shown on every screen — brand always, user greeting/logout only once logged in. */
export function AppHeader({ user, onLogout }: { user: AuraUser | null; onLogout?: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.brand}>AuraEvents</Text>
      {user && (
        <View style={styles.userRow}>
          <Text style={styles.userName}>שלום, {user.firstName}</Text>
          <Pressable onPress={onLogout} accessibilityRole="button">
            <Text style={styles.logout}>התנתקות</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 24,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
  },
  brand: { fontSize: 18, fontWeight: "800", color: "#fafafa" },
  userRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  userName: { fontSize: 13, color: "#a1a1aa" },
  logout: { fontSize: 13, fontWeight: "600", color: "#8b5cf6" },
});
