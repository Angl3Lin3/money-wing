import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatCad, formatUgx } from "../../constants/format";
import { formatPhone } from "../../constants/networks";
import { shortReference, STATUS_INFO } from "../../constants/status";
import { getErrorMessage, Transaction, transactionAPI } from "../../services/api";

export default function TransferScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const [transfer, setTransfer] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    transactionAPI
      .get(id)
      .then(setTransfer)
      .catch((e) => setError(getErrorMessage(e, "Could not load this transfer.")));
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!transfer) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const status = STATUS_INFO[transfer.status];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {created === "1" && (
        <View style={styles.success}>
          <Text style={styles.successTitle}>Transfer created</Text>
          <Text style={styles.successText}>Next, you&apos;ll pay by card to send it.</Text>
        </View>
      )}

      <Text style={styles.amount}>{formatUgx(transfer.ugxAmount)}</Text>
      <Text style={styles.subtitle}>to {transfer.recipient.name}</Text>
      <Text style={[styles.badge, { color: status.color, backgroundColor: status.background }]}>{status.label}</Text>

      <View style={styles.card}>
        <Row label="Reference" value={shortReference(transfer.id)} />
        <Row label="Created" value={new Date(transfer.createdAt).toLocaleString()} />
        <Row label="Recipient" value={transfer.recipient.name} />
        <Row label="Mobile number" value={formatPhone(transfer.recipient.phoneNumber)} />
        <Row label="Network" value={`${transfer.recipient.network} Mobile Money`} />
        <View style={styles.divider} />
        <Row label="You pay" value={formatCad(transfer.cadAmount)} />
        <Row label="Fee (included)" value={formatCad(transfer.fee)} />
        <Row label="Exchange rate" value={`1 CAD = ${formatUgx(transfer.exchangeRate)}`} />
        <Row label="They receive" value={formatUgx(transfer.ugxAmount)} />
      </View>

      {transfer.status === "DRAFT" && (
        <View style={styles.payBox}>
          <Button title="Pay with card" disabled onPress={() => {}} />
          <Text style={styles.note}>Card payment is the next step to build.</Text>
        </View>
      )}

      <Button title="Back to dashboard" onPress={() => router.replace("/dashboard")} color="#666" />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  success: { backgroundColor: "#DCFCE7", padding: 14, borderRadius: 10, marginBottom: 16 },
  successTitle: { fontWeight: "bold", fontSize: 16, color: "#166534" },
  successText: { color: "#166534", marginTop: 2 },
  amount: { fontSize: 28, fontWeight: "bold", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#4B5563", textAlign: "center", marginTop: 2 },
  badge: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "bold",
  },
  card: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 14, marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
  label: { color: "#4B5563" },
  value: { color: "#111827", flexShrink: 1, textAlign: "right" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 6 },
  payBox: { marginBottom: 12 },
  note: { color: "#666", textAlign: "center", marginTop: 6 },
  errorText: { color: "#B91C1C", textAlign: "center" },
});
