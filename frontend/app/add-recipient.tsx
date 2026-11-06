import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, Card, Loading, Notice, Screen, Subtitle, TextField, Title } from "../components/ui";
import { formatPhone, guessNetwork } from "../constants/networks";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
import { showAlert } from "../services/alert";
import { getErrorMessage, Network, Recipient, recipientAPI } from "../services/api";

const NETWORKS: Network[] = ["MTN", "Airtel"];

// Adds a recipient, or edits one when opened with ?id=<recipient id>.
export default function AddRecipientScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);

  const [existing, setExisting] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(editing);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<Network | null>(null);
  const [networkTouched, setNetworkTouched] = useState(editing);
  const [saving, setSaving] = useState(false);

  // When editing, load the recipient and fill in the form.
  useEffect(() => {
    if (!id) return;
    recipientAPI
      .list()
      .then((list) => {
        const r = list.find((x) => x.id === id);
        if (!r) throw new Error("Recipient not found");
        setExisting(r);
        setName(r.name);
        setPhone(formatPhone(r.phoneNumber));
        setNetwork(r.network);
      })
      .catch((e) => {
        showAlert("Could not open recipient", getErrorMessage(e, "Recipient not found"));
        router.replace("/recipients");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Once money has been sent to someone, their number and network can't change.
  const contactLocked = Boolean(existing && (existing.transferCount ?? 0) > 0);

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
      if (existing) await recipientAPI.update(existing.id, name.trim(), phone, network);
      else await recipientAPI.add(name.trim(), phone, network);
      // Back to the previous screen (it reloads when shown). If this screen was
      // opened directly, there's nothing to go back to, so open the list instead.
      if (router.canGoBack()) router.back();
      else router.replace("/recipients");
    } catch (e: any) {
      showAlert(editing ? "Could not save changes" : "Could not add recipient", getErrorMessage(e, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? "Edit Recipient" : "Add Recipient" }} />
      <Title>{editing ? "Edit recipient" : "Add a recipient"}</Title>
      <Subtitle>{editing ? "Fix a name or update their details." : "Who will receive the money in Uganda?"}</Subtitle>

      {contactLocked && (
        <Notice tone="info">
          You&apos;ve already sent money to {existing!.name}, so their number and network can&apos;t change (your
          transfer records must show where the money went). You can still fix their name. To use a different number,
          add them as a new recipient.
        </Notice>
      )}

      <Card>
        <TextField label="Full name" placeholder="e.g. Grace Nakato" value={name} onChangeText={setName} autoComplete="name" />
        <TextField
          label="Uganda mobile number"
          placeholder="e.g. 0772 123 456"
          value={phone}
          onChangeText={onPhoneChange}
          keyboardType="phone-pad"
          editable={!contactLocked}
          style={contactLocked && styles.locked}
          hint={contactLocked ? undefined : "We'll pick the network from the number. You can change it below."}
        />

        <Text style={styles.label}>Mobile money network</Text>
        <View style={styles.networkRow}>
          {NETWORKS.map((n) => {
            const selected = network === n;
            return (
              <Pressable
                key={n}
                disabled={contactLocked}
                onPress={() => {
                  setNetwork(n);
                  setNetworkTouched(true);
                }}
                style={[styles.networkOption, selected && styles.networkSelected, contactLocked && !selected && styles.networkDisabled]}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: contactLocked }}
              >
                <View style={[styles.dot, { backgroundColor: n === "MTN" ? colors.accent : "#e40000" }]} />
                <Text style={[styles.networkText, selected && styles.networkTextSelected]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        <AppButton title={editing ? "Save changes" : "Save recipient"} onPress={save} loading={saving} />
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
  networkDisabled: { opacity: 0.4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  networkText: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.textSecondary },
  networkTextSelected: { color: colors.secondary },
  locked: { color: colors.textMuted },
});
