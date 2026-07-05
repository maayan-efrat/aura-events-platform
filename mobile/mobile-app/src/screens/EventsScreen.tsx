import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getMyRegistrations, type MyRegistration } from "../lib/events";
import type { AuraUser } from "../lib/auth";

const STATUS_LABELS: Record<MyRegistration["status"], string> = {
  Registered: "רשום/ה",
  Waitlisted: "ברשימת המתנה",
  Cancelled: "בוטל",
  CheckedIn: "בוצע צ׳ק-אין",
};

function formatEventDate(isoUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(isoUtc),
  );
}

export function EventsScreen({
  user,
  onSelectRegistration,
}: {
  user: AuraUser;
  onSelectRegistration: (registration: MyRegistration) => void;
}) {
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    getMyRegistrations()
      .then((data) => {
        if (!ignore) setRegistrations(data);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : "שגיאה בטעינת האירועים.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>האירועים שלי, {user.firstName}</Text>

      {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color="#8b5cf6" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!isLoading && !error && registrations.length === 0 && (
        <Text style={styles.empty}>עדיין לא נרשמת לאף אירוע.</Text>
      )}

      <FlatList
        data={registrations}
        keyExtractor={(item) => item.registrationId}
        contentContainerStyle={{ gap: 12, paddingTop: 16 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onSelectRegistration(item)} accessibilityRole="button">
            <Text style={styles.cardTitle}>{item.eventTitle}</Text>
            <Text style={styles.cardDate}>{formatEventDate(item.eventStartAtUtc, item.eventTimezone)}</Text>
            <Text style={styles.cardStatus}>{STATUS_LABELS[item.status]}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#09090b" },
  subtitle: { fontSize: 16, color: "#a1a1aa", textAlign: "right" },
  error: { color: "#fb7185", marginTop: 24, textAlign: "right" },
  empty: { color: "#a1a1aa", marginTop: 24, textAlign: "right" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#303036",
    backgroundColor: "#18181b",
    padding: 16,
  },
  cardTitle: { color: "#fafafa", fontWeight: "600", textAlign: "right" },
  cardDate: { color: "#a78bfa", fontSize: 12, marginTop: 2, textAlign: "right" },
  cardStatus: { color: "#a1a1aa", marginTop: 4, textAlign: "right" },
});
