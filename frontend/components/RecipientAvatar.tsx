import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../constants/theme";

// Circle with the person's initials.
export default function RecipientAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.text}>{initials || "?"}</Text>
    </View>
  );
}

// Network colours: MTN yellow, Airtel red.
export function networkBadgeColors(network: string) {
  return network === "MTN"
    ? { color: "#000000", background: colors.accent }
    : { color: "#ffffff", background: "#e40000" };
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.secondarySoft, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.bold, color: colors.secondary },
});
