import { Link, router } from "expo-router";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { authAPI, getErrorMessage } from "../services/api";
import { saveToken } from "../services/auth-storage";
import { showAlert } from "../services/alert";
import PasswordInput from "../components/PasswordInput";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Error", "Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.login(email.trim(), password);
      await saveToken(result.token);
      router.replace("/dashboard");
    } catch (error: any) {
      const message = getErrorMessage(error, "Login failed");
      // Account exists but was never verified: send them to finish it.
      if (message.includes("verify your email")) {
        showAlert("Verify your email", "Your account isn't verified yet. We'll send you a new code.");
        try {
          await authAPI.resendOTP(email.trim());
          router.push({ pathname: "/otp", params: { email: email.trim() } });
        } catch (resendError: any) {
          showAlert("Error", getErrorMessage(resendError, "Could not send a new code"));
        }
      } else {
        showAlert("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <PasswordInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleLogin}
      />
      <Button title={loading ? "Logging in..." : "Log In"} onPress={handleLogin} disabled={loading} />
      <Link href="/signup" style={styles.link}>No account yet? Sign up</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    width: "80%",
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  link: {
    marginTop: 20,
    color: "blue",
  },
});
