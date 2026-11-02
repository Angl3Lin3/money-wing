import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

// "‹ Back": goes to the previous screen. Hidden when there isn't one
// (e.g. right after refreshing the browser).
export function BackButton({ canGoBack }: { canGoBack: boolean }) {
  if (!canGoBack) return null;
  return (
    <Pressable
      onPress={() => router.back()}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
    >
      <Text style={styles.text}>‹ Back</Text>
    </Pressable>
  );
}

// "⌂ Home": always available. Goes to "/", which sends logged-in users to
// the dashboard and everyone else to the welcome screen.
export function HomeButton() {
  return (
    <Pressable
      onPress={() => router.replace("/")}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Go to home"
      hitSlop={8}
    >
      <Text style={styles.text}>⌂ Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
