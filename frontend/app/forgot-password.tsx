import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import PasswordInput from "../components/PasswordInput";
import { AppButton, Card, Notice, Screen, Spacer, Subtitle, TextField, TextLink, Title } from "../components/ui";
import { fonts } from "../constants/theme";
import { showAlert } from "../services/alert";
import { authAPI, getErrorMessage } from "../services/api";

// Forgot password: 1) enter email, we email a code; 2) enter code + new password.
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter the email you signed up with.");
      return;
    }
    setLoading(true);
    try {
      const result = await authAPI.forgotPassword(email.trim());
      setInfo(`${result.message} It expires in 10 minutes.`);
      setStep("reset");
    } catch (e: any) {
      setError(getErrorMessage(e, "Could not send a code"));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const result = await authAPI.resetPassword(email.trim(), code, password);
      showAlert("Password reset", result.message);
      router.replace("/login");
    } catch (e: any) {
      setError(getErrorMessage(e, "Could not reset the password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen center>
      <Title>Reset your password</Title>
      <Subtitle>
        {step === "email" ? "We'll email you a code to choose a new password." : `Enter the code we emailed to ${email.trim()}.`}
      </Subtitle>

      {error && <Notice tone="danger">{error}</Notice>}
      {info && step === "reset" && !error && <Notice tone="info">{info}</Notice>}

      <Card>
        {step === "email" ? (
          <>
            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              onSubmitEditing={sendCode}
            />
            <AppButton title="Email me a code" onPress={sendCode} loading={loading} />
          </>
        ) : (
          <>
            <TextField
              label="Code"
              placeholder="000000"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              style={styles.code}
            />
            <PasswordInput label="New password" hint="At least 8 characters" value={password} onChangeText={setPassword} />
            <PasswordInput label="Confirm new password" value={confirm} onChangeText={setConfirm} onSubmitEditing={resetPassword} />
            <AppButton title="Set new password" onPress={resetPassword} loading={loading} />
            <Spacer size={10} />
            <AppButton title="Send a new code" variant="ghost" onPress={sendCode} disabled={loading} />
          </>
        )}
      </Card>

      <Spacer size={8} />
      <TextLink center onPress={() => router.replace("/login")}>Back to log in</TextLink>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: fonts.semibold, fontSize: 24, letterSpacing: 8, textAlign: "center" },
});
