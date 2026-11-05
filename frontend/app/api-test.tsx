import { Redirect } from "expo-router";

// The API checks now live in the developer area (API checks tab).
// This keeps old /api-test links working.
export default function APITestScreen() {
  return <Redirect href="/dev-login" />;
}
