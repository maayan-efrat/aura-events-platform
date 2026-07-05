import { Platform } from "react-native";

// Android emulator needs the 10.0.2.2 host alias; web and iOS simulator can both reach the host
// machine directly via localhost. A physical device needs the LAN IP override via .env instead.
const defaultHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";

export const IDENTITY_API_URL = process.env.EXPO_PUBLIC_IDENTITY_API_URL ?? `http://${defaultHost}:5001`;
export const EVENTS_API_URL = process.env.EXPO_PUBLIC_EVENTS_API_URL ?? `http://${defaultHost}:5002`;
