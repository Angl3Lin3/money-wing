import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Logo from "../components/Logo";
import { AppButton, Card, Loading, Screen, Spacer, Subtitle, TextLink } from "../components/ui";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
import { getToken } from "../services/auth-storage";

// Only describe what the app does today. Card payment isn't built yet.
const FEATURES = [
  { icon: "📱", text: "Send to MTN or Airtel Mobile Money in Uganda" },
  { icon: "👁", text: "See the fee and exact amount before you confirm" },
  { icon: "💳", text: "Card payments coming soon" },
];

export default function WelcomeScreen() {
  // Skip this screen if the user is already logged in.
  const [status, setStatus] = useState<"checking" | "loggedIn" | "loggedOut">("checking");

  useEffect(() => {
    getToken()
      .then((token) => setStatus(token ? "loggedIn" : "loggedOut"))
      .catch(() => setStatus("loggedOut"));
  }, []);

  if (status === "checking") return <Loading />;
  if (status === "loggedIn") return <Redirect href="/dashboard" />;

  return (
    <Screen center>
      <Logo width={260} />
      <Subtitle center style={styles.tagline}>Send money from Canada to Uganda, simply.</Subtitle>

      <View style={styles.route}>
        <Text style={styles.routeText}>🇨🇦 CAD</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.routeText}>🇺🇬 UGX</Text>
      </View>

      <Card>
        {FEATURES.map((f) => (
          <View key={f.text} style={styles.feature}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </Card>

      <AppButton title="Create account" onPress={() => router.push("/signup")} />
      <Spacer size={spacing.md} />
      <AppButton title="Log in" variant="secondary" onPress={() => router.push("/login")} />
      {/* Developer tools: only shown while developing, never in the real app */}
      {__DEV__ && (
        <>
          <Spacer size={spacing.xl} />
          <TextLink center onPress={() => router.push("/dev-login")}>Developer area</TextLink>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: { marginTop: spacing.lg },
  route: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  routeText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.textSecondary },
  arrow: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.primary },
  feature: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
  featureIcon: { fontSize: 20, width: 28, textAlign: "center" },
  featureText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.textSecondary },
});
