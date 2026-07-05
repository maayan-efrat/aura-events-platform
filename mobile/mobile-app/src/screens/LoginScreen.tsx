import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { login, type AuraUser } from "../lib/auth";

const EMAIL_DOMAINS = ["gmail.com", "walla.co.il", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: AuraUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const domainSuggestions = useMemo(() => {
    const atIndex = email.indexOf("@");
    if (atIndex === -1) return [];
    const typedDomain = email.slice(atIndex + 1);
    const localPart = email.slice(0, atIndex);
    if (!localPart) return [];
    return EMAIL_DOMAINS.filter(
      (domain) => domain.startsWith(typedDomain) && domain !== typedDomain,
    ).map((domain) => `${localPart}@${domain}`);
  }, [email]);

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
      <View pointerEvents="none" style={styles.glow} />

      <View style={styles.brandBadge}>
        <Ionicons name="sparkles" size={28} color="#c4b5fd" />
      </View>
      <Text style={styles.brandTitle}>AuraEvents</Text>
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

      {domainSuggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsRow}
          contentContainerStyle={{ gap: 8 }}
        >
          {domainSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => setEmail(suggestion)}
              style={styles.suggestionChip}
              accessibilityRole="button"
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.passwordWrapper}>
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
          <Ionicons name={isPasswordVisible ? "eye-off" : "eye"} size={20} color="#a78bfa" />
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
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#09090b", overflow: "hidden" },
  glow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "#8b5cf6",
    opacity: 0.18,
  },
  brandBadge: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  brandTitle: { fontSize: 22, fontWeight: "800", color: "#fafafa", textAlign: "center" },
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
  suggestionsRow: { marginTop: -6, marginBottom: 12 },
  suggestionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#303036",
    backgroundColor: "#18181b",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
  passwordWrapper: { position: "relative", marginBottom: 12 },
  // Left padding reserves room for the overlaid eye icon so typed text never runs under it —
  // matches the web app's Input.tsx (absolute icon inside the field, not a sibling that shrinks it).
  passwordInput: { marginBottom: 0, paddingLeft: 44 },
  passwordToggle: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
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
