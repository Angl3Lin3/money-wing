import { router } from "expo-router";
import { useState } from "react";
import PasswordInput from "../components/PasswordInput";
import { AppButton, Card, Screen, Spacer, Subtitle, TextField, TextLink, Title } from "../components/ui";
import { showAlert } from "../services/alert";
import { authAPI, getErrorMessage } from "../services/api";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      showAlert("Missing details", "Please enter your email and a password.");
      return;
    }

    setLoading(true);
    try {
      await authAPI.signup(email.trim(), password);
      router.push({ pathname: "/otp", params: { email: email.trim() } });
    } catch (error: any) {
      showAlert("Could not create account", getErrorMessage(error, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen center>
      <Title>Create your account</Title>
      <Subtitle>It takes less than a minute.</Subtitle>

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
          placeholder="Choose a password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleSignUp}
        />
        <AppButton title="Create account" onPress={handleSignUp} loading={loading} />
      </Card>

      <Spacer size={8} />
      <TextLink center onPress={() => router.replace("/login")}>Already have an account? Log in</TextLink>
    </Screen>
  );
}
