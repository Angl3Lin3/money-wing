import { Link, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { getToken } from "../services/auth-storage";

export default function WelcomeScreen() {
  // Skip this screen if the user is already logged in.
  const [status, setStatus] = useState<"checking" | "loggedIn" | "loggedOut">("checking");

  useEffect(() => {
    getToken()
      .then((token) => setStatus(token ? "loggedIn" : "loggedOut"))
      .catch(() => setStatus("loggedOut"));
  }, []);

  if (status === "checking") {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === "loggedIn") {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to MoneyWing</Text>
      <Text style={styles.subtitle}>Send money to Uganda seamlessly</Text>

      <View style={styles.buttonContainer}>
        <Link href="/signup" asChild>
          <Button title="Create Account" />
        </Link>
        <Link href="/login" asChild>
          <Button title="Login" color="#666" />
        </Link>
        <Link href="/api-test" asChild>
          <Button title="Test API Connection" color="#28a745" />
        </Link>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '80%',
    gap: 10,
  }
});