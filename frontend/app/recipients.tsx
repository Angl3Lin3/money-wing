import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import RecipientAvatar, { networkBadgeColors } from "../components/RecipientAvatar";
import { AppButton, Badge, Body, Card, Loading, Notice, Screen, Spacer, Subtitle, Title } from "../components/ui";
import { formatPhone } from "../constants/networks";
import { colors, fonts, fontSize, spacing } from "../constants/theme";
import { confirmAction, showAlert } from "../services/alert";
import { getErrorMessage, Recipient, recipientAPI } from "../services/api";

export default function RecipientsScreen() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecipients(await recipientAPI.list());
    } catch (e: any) {
      setError(getErrorMessage(e, "Could not load recipients"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time this screen is shown (e.g. after adding someone).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = async (recipient: Recipient) => {
    const ok = await confirmAction("Delete recipient", `Remove ${recipient.name}?`, "Delete");
    if (!ok) return;
    try {
      await recipientAPI.remove(recipient.id);
      setRecipients((list) => list.filter((r) => r.id !== recipient.id));
    } catch (e: any) {
      showAlert("Error", getErrorMessage(e, "Could not delete recipient"));
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <Title>Recipients</Title>
      <Subtitle>People in Uganda you send money to.</Subtitle>

      {error && <Notice tone="danger">{error}</Notice>}

      {recipients.length === 0 && !error ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No recipients yet</Text>
          <Body center>Add someone to start sending money.</Body>
        </Card>
      ) : (
        <Card style={styles.list}>
          {recipients.map((item, index) => {
            const badge = networkBadgeColors(item.network);
            return (
              <View key={item.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                <RecipientAvatar name={item.name} />
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.phone}>{formatPhone(item.phoneNumber)}</Text>
                  <Spacer size={6} />
                  <Badge label={item.network} color={badge.color} background={badge.background} />
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => router.push({ pathname: "/send", params: { recipientId: item.id } })}
                    style={[styles.actionButton, styles.sendButton]}
                    accessibilityLabel={`Send money to ${item.name}`}
                  >
                    <Text style={[styles.actionText, styles.sendText]}>Send</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => remove(item)}
                    style={[styles.actionButton, styles.deleteButton]}
                    accessibilityLabel={`Delete ${item.name}`}
                  >
                    <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <AppButton title="+ Add recipient" onPress={() => router.push("/add-recipient")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: spacing.sm },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  list: { paddingVertical: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  info: { flex: 1 },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.text },
  phone: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  // Both buttons are the same size so their text lines up.
  actions: { gap: spacing.sm },
  actionButton: { width: 72, paddingVertical: 6, borderRadius: 999, alignItems: "center" },
  actionText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, textAlign: "center" },
  sendButton: { backgroundColor: colors.primarySoft },
  sendText: { color: colors.primary },
  deleteButton: { backgroundColor: colors.dangerSoft },
  deleteText: { color: colors.danger },
});
