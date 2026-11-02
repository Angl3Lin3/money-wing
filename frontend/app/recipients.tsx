import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Button, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatPhone } from "../constants/networks";
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Try again" onPress={load} />
        </View>
      )}

      <FlatList
        data={recipients}
        keyExtractor={(r) => r.id}
        contentContainerStyle={recipients.length === 0 && styles.center}
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No recipients yet</Text>
              <Text style={styles.emptyText}>Add the people in Uganda you want to send money to.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone}>{formatPhone(item.phoneNumber)}</Text>
            </View>
            <Text style={[styles.badge, item.network === "MTN" ? styles.mtn : styles.airtel]}>
              {item.network}
            </Text>
            <Pressable onPress={() => remove(item)} style={styles.deleteButton} accessibilityLabel={`Delete ${item.name}`}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Button title="+ Add recipient" onPress={() => router.push("/add-recipient")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 6 },
  emptyText: { color: "#666", textAlign: "center" },
  errorBox: { margin: 16, padding: 12, backgroundColor: "#FEF2F2", borderRadius: 8, gap: 8 },
  errorText: { color: "#B91C1C" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontWeight: "bold", color: "#1E40AF" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600" },
  phone: { color: "#666", marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    overflow: "hidden",
    marginRight: 8,
  },
  mtn: { backgroundColor: "#FEF3C7", color: "#92400E" },
  airtel: { backgroundColor: "#FEE2E2", color: "#B91C1C" },
  deleteButton: { padding: 6 },
  deleteText: { color: "#B91C1C" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
});
