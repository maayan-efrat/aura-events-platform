import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppHeader } from "./src/components/AppHeader";
import { AppFooter } from "./src/components/AppFooter";
import { LoginScreen } from "./src/screens/LoginScreen";
import { EventsScreen } from "./src/screens/EventsScreen";
import { QrCodeScreen } from "./src/screens/QrCodeScreen";
import { getStoredUser, logout, type AuraUser } from "./src/lib/auth";
import type { MyRegistration } from "./src/lib/events";

type Screen = { name: "events" } | { name: "qr"; registration: MyRegistration };

/**
 * The web target (expo start --web) renders into a real browser, which defaults to a light
 * scrollbar that clashes with this app's all-dark theme — react-native-web has no equivalent of
 * a global stylesheet, so this is the only way to reach it (no-op on native, no `document` there).
 */
function injectDarkScrollbarStyles() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const styleId = "aura-dark-scrollbar";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    * { scrollbar-width: thin; scrollbar-color: #303036 transparent; }
    *::-webkit-scrollbar { width: 10px; height: 10px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background-color: #303036; border-radius: 9999px; border: 2px solid #09090b; }
    *::-webkit-scrollbar-thumb:hover { background-color: #52525b; }
  `;
  document.head.appendChild(style);
}

export default function App() {
  const [user, setUser] = useState<AuraUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: "events" });

  useEffect(injectDarkScrollbarStyles, []);

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
