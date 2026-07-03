import { Pressable, StyleSheet, Text, View } from "react-native";
import { MockQrCode } from "../components/MockQrCode";
import type { MyRegistration } from "../lib/events";

export function QrCodeScreen({ registration, onBack }: { registration: MyRegistration; onBack: () => void }) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>‹ חזרה</Text>
      </Pressable>

      <Text style={styles.title}>קוד הכניסה שלך</Text>
      <Text style={styles.subtitle}>הציגו את הקוד בכניסה לאירוע</Text>

      <MockQrCode seed={registration.registrationId} />

      <Text style={styles.note}>
        * זהו מוקאפ ויזואלי בלבד. ליצירת קוד QR אמיתי וסריק, יש להוסיף ספרייה כמו
        react-native-qrcode-svg.
      </Text>

      <View style={styles.details}>
        <Text style={styles.detailLabel}>מזהה הרשמה</Text>
        <Text style={styles.detailValue}>{registration.registrationId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: "#09090b", alignItems: "center" },
  back: { alignSelf: "flex-end", marginBottom: 24 },
  backText: { color: "#8b5cf6", fontWeight: "600", fontSize: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#fafafa" },
  subtitle: { fontSize: 14, color: "#a1a1aa", marginTop: 4, marginBottom: 32 },
  note: { color: "#71717a", fontSize: 12, textAlign: "center", marginTop: 20, maxWidth: 260 },
  details: { marginTop: 32, alignItems: "center" },
  detailLabel: { color: "#a1a1aa", fontSize: 12 },
  detailValue: { color: "#fafafa", fontSize: 14, marginTop: 4 },
});
