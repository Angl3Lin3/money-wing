import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInputProps } from "react-native";
import { colors, fonts, fontSize } from "../constants/theme";
import { TextField } from "./ui";

// A password field with a Show/Hide button so users can check what they typed.
export default function PasswordInput(props: Omit<TextInputProps, "secureTextEntry"> & { label?: string; hint?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Text style={styles.toggleText}>{visible ? "Hide" : "Show"}</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: { paddingHorizontal: 14, paddingVertical: 12 },
  toggleText: { color: colors.secondary, fontFamily: fonts.semibold, fontSize: fontSize.sm },
});
