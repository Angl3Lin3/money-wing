import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

// A password field with a Show/Hide button so users can check what they typed.
export default function PasswordInput(props: Omit<TextInputProps, "secureTextEntry">) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <TextInput
        {...props}
        style={styles.input}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Text style={styles.toggleText}>{visible ? "Hide" : "Show"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "80%",
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: "100%",
    padding: 10,
  },
  toggle: {
    paddingHorizontal: 12,
    height: "100%",
    justifyContent: "center",
  },
  toggleText: {
    color: "#1E40AF",
    fontWeight: "600",
  },
});
