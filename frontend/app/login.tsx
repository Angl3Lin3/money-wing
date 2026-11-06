import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import PasswordInput from "../components/PasswordInput";
import { AppButton, Card, Screen, Spacer, Subtitle, TextField, TextLink, Title } from "../components/ui";
import { showAlert } from "../services/alert";
import { authAPI, getErrorMessage } from "../services/api";
import { saveToken } from "../services/auth-storage";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert("Missing details", "Please enter your email and password.");
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
        showAlert("Could not log in", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen center>
      <Title>Welcome back</Title>
      <Subtitle>Log in to send money.</Subtitle>

      <Card>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <PasswordInput
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />
        <View style={styles.forgot}>
          <TextLink onPress={() => router.push({ pathname: "/forgot-password", params: { email: email.trim() } })}>
            Forgot password?
          </TextLink>
        </View>
        <AppButton title="Log in" onPress={handleLogin} loading={loading} />
      </Card>

      <Spacer size={8} />
      <TextLink center onPress={() => router.replace("/signup")}>No account yet? Sign up</TextLink>
    </Screen>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: "flex-end", marginTop: -6, marginBottom: 16 },
});
