import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { AppButton, Card, Screen, Spacer, Subtitle, TextField, Title } from "../components/ui";
import { fonts } from "../constants/theme";
import { showAlert } from "../services/alert";
import { authAPI, getErrorMessage } from "../services/api";
import { saveToken } from "../services/auth-storage";

export default function OTPScreen() {
  const params = useLocalSearchParams();
  const email = params.email as string;
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const resendOtp = async () => {
    setResending(true);
    try {
      await authAPI.resendOTP(email);
      showAlert("Code sent", "A new code is on its way.");
    } catch (error: any) {
      showAlert("Error", getErrorMessage(error, "Could not resend the code"));
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
        <AppButton title="Resend code" variant="ghost" onPress={resendOtp} loading={resending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: fonts.semibold, fontSize: 24, letterSpacing: 8, textAlign: "center" },
});
