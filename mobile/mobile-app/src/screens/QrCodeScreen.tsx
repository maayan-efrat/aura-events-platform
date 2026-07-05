import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { authedFetch } from "../lib/auth";
import { EVENTS_API_URL } from "../lib/config";
import type { MyRegistration } from "../lib/events";

/** Converts a Blob to a base64 data URI — works identically on native RN and react-native-web. */
function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function QrCodeScreen({ registration, onBack }: { registration: MyRegistration; onBack: () => void }) {
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const qrUrl = `${EVENTS_API_URL}/api/events/${registration.eventId}/registrations/me/qr`;

    // Fetching manually (rather than passing an Authorization header directly on <Image>'s
    // source) is what actually works across every target this app runs on — RN's Image "headers"
    // option isn't honored by react-native-web, which renders Image as a plain <img> that can't
    // attach custom headers at all, so the request went out unauthenticated and silently failed.
    authedFetch(qrUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`qr fetch failed with ${response.status}`);
        const blob = await response.blob();
        return blobToDataUri(blob);
      })
      .then((dataUri) => {
        if (!ignore) setQrDataUri(dataUri);
      })
      .catch(() => {
        if (!ignore) setError("לא ניתן היה לטעון את קוד הכניסה.");
      });

    return () => {
      ignore = true;
    };
  }, [registration.eventId]);

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
        <Text style={styles.backText}>‹ חזרה</Text>
      </Pressable>

      <Text style={styles.title}>{registration.eventTitle}</Text>
      <Text style={styles.subtitle}>הציגו את הקוד בכניסה לאירוע</Text>

      <View style={styles.qrFrame}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : qrDataUri ? (
          <Image source={{ uri: qrDataUri }} style={styles.qrImage} resizeMode="contain" />
        ) : (
          <ActivityIndicator color="#8b5cf6" />
        )}
      </View>

      <View style={styles.details}>
        <Text style={styles.detailLabel}>קוד כרטיס (לצ׳ק-אין ידני)</Text>
        <Text selectable style={styles.detailValue}>
          {registration.ticketCode}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#09090b", alignItems: "center" },
  back: { alignSelf: "flex-end", marginBottom: 24 },
  backText: { color: "#8b5cf6", fontWeight: "600", fontSize: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#fafafa", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#a1a1aa", marginTop: 4, marginBottom: 32 },
  qrFrame: {
    width: 240,
    height: 240,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  qrImage: { width: 220, height: 220 },
  error: { color: "#be123c", fontSize: 13, textAlign: "center", paddingHorizontal: 12 },
  details: { marginTop: 32, alignItems: "center" },
  detailLabel: { color: "#a1a1aa", fontSize: 12 },
  detailValue: { color: "#fafafa", fontSize: 14, marginTop: 4 },
});
