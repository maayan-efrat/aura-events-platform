import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
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

  if (isRestoringSession) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#09090b" }}>
        <ActivityIndicator color="#8b5cf6" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLoggedIn={setUser} />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <>
      {screen.name === "events" && (
        <EventsScreen
          user={user}
          onLogout={handleLogout}
          onSelectRegistration={(registration) => setScreen({ name: "qr", registration })}
        />
      )}
      {screen.name === "qr" && (
        <QrCodeScreen registration={screen.registration} onBack={() => setScreen({ name: "events" })} />
      )}
      <StatusBar style="light" />
    </>
  );
}
