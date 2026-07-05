import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { login, type AuraUser } from "../lib/auth";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: AuraUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setIsLoading(true);
    try {
      const user = await login(email, password);
      onLoggedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "אירעה שגיאה בהתחברות.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AuraEvents</Text>
      <Text style={styles.subtitle}>התחברות</Text>

      <TextInput
        style={styles.input}
        placeholder="אימייל"
        placeholderTextColor="#a1a1aa"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="סיסמה"
          placeholderTextColor="#a1a1aa"
          secureTextEntry={!isPasswordVisible}
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={styles.passwordToggle}
          onPress={() => setIsPasswordVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityLabel={isPasswordVisible ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
        >
          <Text style={styles.passwordToggleText}>{isPasswordVisible ? "הסתר" : "הצג"}</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
        accessibilityRole="button"
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>התחברות</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#09090b" },
  title: { fontSize: 32, fontWeight: "800", color: "#fafafa", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#a1a1aa", textAlign: "center", marginTop: 4, marginBottom: 32 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#303036",
    backgroundColor: "#18181b",
    color: "#fafafa",
    paddingHorizontal: 16,
    marginBottom: 12,
    textAlign: "right",
  },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  passwordInput: { flex: 1, marginBottom: 0 },
  passwordToggle: { paddingHorizontal: 12, marginStart: 8 },
  passwordToggleText: { color: "#a78bfa", fontWeight: "600", fontSize: 14 },
  error: { color: "#fb7185", marginBottom: 12, marginTop: 12, textAlign: "right" },
  button: {
    height: 48,
    borderRadius: 999,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
