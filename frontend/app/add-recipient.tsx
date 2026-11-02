import { router } from "expo-router";
import { useState } from "react";
import { Button, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { guessNetwork } from "../constants/networks";
import { showAlert } from "../services/alert";
import { getErrorMessage, Network, recipientAPI } from "../services/api";

const NETWORKS: Network[] = ["MTN", "Airtel"];

export default function AddRecipientScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<Network | null>(null);
  const [networkTouched, setNetworkTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const onPhoneChange = (value: string) => {
    setPhone(value);
    // Pick the network automatically until the user chooses one themselves.
    if (!networkTouched) setNetwork(guessNetwork(value));
  };

  const save = async () => {
    if (!name.trim() || !phone.trim() || !network) {
      showAlert("Missing details", "Please enter a name, a phone number, and choose a network.");
      return;
    }

    setSaving(true);
    try {
      await recipientAPI.add(name.trim(), phone, network);
      // Back to the list (it reloads when shown). If this screen was opened
      // directly, there's nothing to go back to, so open the list instead.
      if (router.canGoBack()) router.back();
      else router.replace("/recipients");
    } catch (e: any) {
      showAlert("Could not add recipient", getErrorMessage(e, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Full name</Text>
      <TextInput style={styles.input} placeholder="e.g. Grace Nakato" value={name} onChangeText={setName} />

      <Text style={styles.label}>Uganda mobile number</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 0772 123 456"
        value={phone}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Mobile money network</Text>
      <View style={styles.networkRow}>
        {NETWORKS.map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              setNetwork(n);
              setNetworkTouched(true);
            }}
            style={[styles.networkOption, network === n && styles.networkSelected]}
            accessibilityRole="radio"
            accessibilityState={{ selected: network === n }}
          >
            <Text style={[styles.networkText, network === n && styles.networkTextSelected]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.saveButton}>
        <Button title={saving ? "Saving..." : "Save recipient"} onPress={save} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  label: { fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: {
    height: 44,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  networkRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  networkOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    alignItems: "center",
  },
  networkSelected: { borderColor: "#1E40AF", backgroundColor: "#EFF6FF" },
  networkText: { fontWeight: "600", color: "#444" },
  networkTextSelected: { color: "#1E40AF" },
  saveButton: { marginTop: 20 },
});
