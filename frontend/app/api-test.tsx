import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton, Body, Caption, Card, Screen, SectionLabel, Spacer, Title } from "../components/ui";
import { colors, fonts, fontSize, spacing } from "../constants/theme";
import { API_BASE_URL } from "./constants/config";
import { authAPI, healthCheck, userAPI } from "../services/api";

// Developer tool: checks that the app can reach the server.
// Only linked from the welcome screen while developing.
export default function APITestScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<{ time: string; ok: boolean; message: string }[]>([]);

  const run = async (name: string, test: () => Promise<string>) => {
    setBusy(name);
    const time = new Date().toLocaleTimeString();
    try {
      const message = await test();
      setResults((list) => [{ time, ok: true, message }, ...list]);
    } catch (error: any) {
      const reason = error?.response?.data?.error || error?.message || "Unknown error";
      setResults((list) => [{ time, ok: false, message: `${name} failed: ${reason}` }, ...list]);
    } finally {
      setBusy(null);
    }
  };

  const testHealth = () =>
    run("Server check", async () => {
      await healthCheck();
      return "Server is running and reachable";
    });

  const testSignup = () =>
    run("Test signup", async () => {
      const email = `test${Date.now()}@example.com`;
      await authAPI.signup(email, "testpassword123");
      return `Created test account ${email}`;
    });

  const testProfile = () =>
    run("Logged-in check", async () => {
      const profile = await userAPI.getProfile();
      return `Logged in as ${profile.user?.email ?? profile.email}`;
    });

  return (
    <Screen>
      <Title>API connection test</Title>
      <Body>Checks that this app can talk to the MoneyWing server.</Body>
      <Caption style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>Server: {API_BASE_URL}</Caption>

      <Card>
        <AppButton title="Check server" onPress={testHealth} loading={busy === "Server check"} />
        <Spacer size={spacing.md} />
        <AppButton title="Create a test account" variant="secondary" onPress={testSignup} loading={busy === "Test signup"} />
        <Spacer size={spacing.md} />
        <AppButton title="Check I'm logged in" variant="secondary" onPress={testProfile} loading={busy === "Logged-in check"} />
        {results.length > 0 && (
          <>
            <Spacer size={spacing.md} />
            <AppButton title="Clear results" variant="ghost" onPress={() => setResults([])} />
          </>
        )}
      </Card>

      <SectionLabel>Results</SectionLabel>
      <Card>
        {results.length === 0 ? (
          <Caption>No tests run yet.</Caption>
        ) : (
          results.map((r, i) => (
            <View key={i} style={[styles.result, i > 0 && styles.resultBorder]}>
              <Text style={[styles.icon, { color: r.ok ? colors.success : colors.danger }]}>{r.ok ? "✓" : "✕"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.message}>{r.message}</Text>
                <Text style={styles.time}>{r.time}</Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
  resultBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  icon: { fontFamily: fonts.bold, fontSize: fontSize.lg, width: 18 },
  message: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.text },
  time: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
});
