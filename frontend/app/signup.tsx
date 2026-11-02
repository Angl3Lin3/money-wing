import { Link, router } from "expo-router";
import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { authAPI, getErrorMessage } from "../services/api";
import { showAlert } from "../services/alert";
import PasswordInput from "../components/PasswordInput";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await authAPI.signup(email.trim(), password);
      router.push({ pathname: '/otp', params: { email: email.trim() } });
    } catch (error: any) {
      showAlert('Error', getErrorMessage(error, 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

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
      />

      <Button title={loading ? "Creating account..." : "Sign Up"} onPress={handleSignUp} disabled={loading} />
      <Link href="/login" style={styles.backLink}>Already have an account? Log in</Link>
  
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
  backLink: {
    marginTop: 20,
    color: "blue",
  },
});
