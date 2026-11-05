import { router } from "expo-router";
import { useEffect, useState } from "react";
import PasswordInput from "../components/PasswordInput";
import { AppButton, Card, Loading, Notice, Screen, Subtitle, TextField, Title } from "../components/ui";
import { adminAPI } from "../services/admin-api";
import { authAPI, getErrorMessage } from "../services/api";
import { clearDevToken, getDevToken, saveDevToken } from "../services/auth-storage";

// Login for the developer area. Only accounts listed in ADMIN_EMAILS
// (backend/.env) get past this screen.
export default function DevLoginScreen() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already logged in to the developer area? Go straight in.
  useEffect(() => {
    getDevToken()
      .then(async (token) => {
        if (!token) return;
        await adminAPI.overview();
        router.replace("/dev");
      })
      .catch(() => clearDevToken())
      .finally(() => setChecking(false));
  }, []);

  const login = async () => {
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token } = await authAPI.login(email.trim(), password);
      await saveDevToken(token);
      await adminAPI.overview(); // throws 403 if this account isn't a developer
      router.replace("/dev");
    } catch (e: any) {
      await clearDevToken();
      if (e?.response?.status === 403) {
        setError(
          `${email.trim()} isn't allowed into the developer area. Add it to ADMIN_EMAILS in backend/.env, save, and try again.`
        );
      } else {
        setError(getErrorMessage(e, "Login failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <Loading />;

  return (
    <Screen center hideDemoBanner>
      <Title>Developer area</Title>
      <Subtitle>For the MoneyWing team only. Log in with an app account listed in ADMIN_EMAILS.</Subtitle>

      {error && <Notice tone="danger">{error}</Notice>}

      <Card>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <PasswordInput label="Password" placeholder="Your password" value={password} onChangeText={setPassword} onSubmitEditing={login} />
        <AppButton title="Log in to developer area" onPress={login} loading={loading} />
      </Card>
    </Screen>
  );
}
