import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { AppButton, Card, Screen, Spacer, Subtitle, TextField, Title } from "../components/ui";
import { fonts } from "../constants/theme";
import { showAlert } from "../services/alert";
import { authAPI, getErrorMessage } from "../services/api";
import { saveToken } from "../services/auth-storage";
import { useCooldown } from "../hooks/useCooldown";

export default function OTPScreen() {
  const params = useLocalSearchParams();
  const email = params.email as string;
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // A code was just sent to get here, so the first resend waits 30 seconds.
  const [secondsLeft, startCooldown] = useCooldown(30);

  const resendOtp = async () => {
    setResending(true);
    try {
      await authAPI.resendOTP(email);
      startCooldown(30);
      showAlert("Code sent", "A new code is on its way.");
    } catch (error: any) {
      if (error?.response?.status === 429) {
        startCooldown(error.response.data?.retryAfterSeconds ?? 30);
        showAlert("Please wait", getErrorMessage(error, "Please wait before asking for a new code."));
      } else {
        showAlert("Error", getErrorMessage(error, "Could not resend the code"));
      }
    } finally {
      setResending(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      showAlert("Check the code", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.verifyOTP(email, otp);
      await saveToken(result.token); // stay logged in
      router.replace("/dashboard");
    } catch (error: any) {
      showAlert("Could not verify", getErrorMessage(error, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen center>
      <Title>Check your email</Title>
      <Subtitle>We sent a 6-digit code to {email}.</Subtitle>

      <Card>
        <TextField
          label="Verification code"
          placeholder="000000"
          value={otp}
          onChangeText={(text) => setOtp(text.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={6}
          onSubmitEditing={verifyOtp}
          returnKeyType="done"
          autoComplete="one-time-code"
          style={styles.code}
        />
        <AppButton title="Verify" onPress={verifyOtp} loading={loading} />
        <Spacer size={10} />
        <AppButton
          title={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
          variant="ghost"
          onPress={resendOtp}
          loading={resending}
          disabled={secondsLeft > 0}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: fonts.semibold, fontSize: 24, letterSpacing: 8, textAlign: "center" },
});
