import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WingIcon } from "./Logo";
import { fonts } from "../constants/theme";

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

// Home button: the MoneyWing wing in a white circle. Always available.
// Goes to "/", which sends logged-in users to the dashboard and everyone
// else to the welcome screen.
export function HomeButton() {
  return (
    <Pressable
      onPress={() => router.replace("/")}
      style={({ pressed }) => [styles.home, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel="Go to home"
      hitSlop={8}
    >
      <View style={styles.homeCircle}>
        <WingIcon size={28} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  home: { paddingHorizontal: 12, paddingVertical: 4 },
  homeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  button: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: "#fff", fontSize: 15, fontFamily: fonts.medium },
});
