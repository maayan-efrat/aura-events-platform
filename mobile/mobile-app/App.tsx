import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppHeader } from "./src/components/AppHeader";
import { AppFooter } from "./src/components/AppFooter";
import { LoginScreen } from "./src/screens/LoginScreen";
import { EventsScreen } from "./src/screens/EventsScreen";
import { QrCodeScreen } from "./src/screens/QrCodeScreen";
import { getStoredUser, logout, type AuraUser } from "./src/lib/auth";
import type { MyRegistration } from "./src/lib/events";

type Screen = { name: "events" } | { name: "qr"; registration: MyRegistration };

export default function App() {
  const [user, setUser] = useState<AuraUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: "events" });

  useEffect(() => {
    let ignore = false;
    getStoredUser()
      .then((storedUser) => {
        if (!ignore) setUser(storedUser);
      })
      .finally(() => {
        if (!ignore) setIsRestoringSession(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setScreen({ name: "events" });
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#09090b" }}>
      <AppHeader user={user} onLogout={user ? handleLogout : undefined} />

      <View style={{ flex: 1 }}>
        {isRestoringSession && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#8b5cf6" />
          </View>
        )}

        {!isRestoringSession && !user && <LoginScreen onLoggedIn={setUser} />}

        {!isRestoringSession && user && screen.name === "events" && (
          <EventsScreen user={user} onSelectRegistration={(registration) => setScreen({ name: "qr", registration })} />
        )}
        {!isRestoringSession && user && screen.name === "qr" && (
          <QrCodeScreen registration={screen.registration} onBack={() => setScreen({ name: "events" })} />
        )}
      </View>

      <AppFooter />
      <StatusBar style="light" />
    </View>
  );
}
