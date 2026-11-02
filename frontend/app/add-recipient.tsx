import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, Card, Screen, Subtitle, TextField, Title } from "../components/ui";
import { guessNetwork } from "../constants/networks";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
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
      // Back to the previous screen (it reloads when shown). If this screen was
      // opened directly, there's nothing to go back to, so open the list instead.
      if (router.canGoBack()) router.back();
      else router.replace("/recipients");
    } catch (e: any) {
      showAlert("Could not add recipient", getErrorMessage(e, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Title>Add a recipient</Title>
      <Subtitle>Who will receive the money in Uganda?</Subtitle>

      <Card>
        <TextField label="Full name" placeholder="e.g. Grace Nakato" value={name} onChangeText={setName} autoComplete="name" />
        <TextField
          label="Uganda mobile number"
          placeholder="e.g. 0772 123 456"
          value={phone}
          onChangeText={onPhoneChange}
          keyboardType="phone-pad"
          hint="We'll pick the network from the number. You can change it below."
        />

        <Text style={styles.label}>Mobile money network</Text>
        <View style={styles.networkRow}>
          {NETWORKS.map((n) => {
            const selected = network === n;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  setNetwork(n);
                  setNetworkTouched(true);
                }}
                style={[styles.networkOption, selected && styles.networkSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={[styles.dot, { backgroundColor: n === "MTN" ? colors.accent : "#e40000" }]} />
                <Text style={[styles.networkText, selected && styles.networkTextSelected]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        <AppButton title="Save recipient" onPress={save} loading={saving} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 6 },
  networkRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl },
  networkOption: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
  },
  networkSelected: { borderColor: colors.secondary, backgroundColor: colors.secondarySoft },
  dot: { width: 10, height: 10, borderRadius: 5 },
  networkText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.textSecondary },
  networkTextSelected: { color: colors.secondary },
});
