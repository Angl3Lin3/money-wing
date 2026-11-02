import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatCad, formatUgx } from "../constants/format";
import { formatPhone } from "../constants/networks";
import { showAlert } from "../services/alert";
import { getErrorMessage, Quote, quoteAPI, Recipient, recipientAPI, transactionAPI } from "../services/api";

export default function ReviewScreen() {
  const { recipientId, cadAmount } = useLocalSearchParams<{ recipientId: string; cadAmount: string }>();

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);

  // Load the recipient and a fresh quote for the amount.
  useEffect(() => {
    if (!recipientId || !cadAmount) {
      setLoadError("Missing transfer details. Please start again.");
      return;
    }
    Promise.all([recipientAPI.list(), quoteAPI.get(cadAmount)])
      .then(([list, q]) => {
        const r = list.find((x) => x.id === recipientId);
        if (!r) throw new Error("Recipient not found");
        setRecipient(r);
        setQuote(q);
      })
      .catch((e) => setLoadError(getErrorMessage(e, "Could not load the transfer details.")));
  }, [recipientId, cadAmount]);

  const confirm = async () => {
    if (!recipient || !quote || confirming) return;
    setConfirming(true);
    try {
      const transaction = await transactionAPI.create(recipient.id, quote);
      // Replace, so Back from the next screen doesn't return to a used review.
      router.replace({ pathname: "/transfer/[id]", params: { id: transaction.id, created: "1" } });
    } catch (e: any) {
      if (e?.response?.status === 409 && e.response.data?.quote) {
        // The rate or fee changed: show the new numbers and ask again.
        setQuote(e.response.data.quote);
        setPriceChanged(true);
        showAlert("Amounts updated", e.response.data.error);
      } else {
        showAlert("Could not create transfer", getErrorMessage(e, "Please try again."));
      }
      setConfirming(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Button title="Back to Send Money" onPress={() => router.replace("/send")} />
      </View>
    );
  }

  if (!recipient || !quote) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Check the details</Text>

      {priceChanged && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>The amounts below were updated. Please check them again.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recipient</Text>
        <Row label="Name" value={recipient.name} />
        <Row label="Mobile number" value={formatPhone(recipient.phoneNumber)} />
        <Row label="Network" value={`${recipient.network} Mobile Money`} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Amount</Text>
        <Row label="You pay" value={formatCad(quote.cadAmount)} />
        <Row label="Fee (included)" value={formatCad(quote.fee)} />
        <Row label="Exchange rate" value={`1 CAD = ${formatUgx(quote.exchangeRate)}`} />
        <View style={styles.divider} />
        <Row label={`${recipient.name} receives`} value={formatUgx(quote.ugxAmount)} bold />
      </View>

      <Button title={confirming ? "Creating transfer..." : "Confirm"} onPress={confirm} disabled={confirming} />
      <Text style={styles.note}>You&apos;ll pay by card in the next step.</Text>
    </ScrollView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, gap: 12 },
  heading: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  card: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 14, marginBottom: 14 },
  cardTitle: { fontWeight: "bold", color: "#6B7280", marginBottom: 6, textTransform: "uppercase", fontSize: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
  label: { color: "#4B5563" },
  value: { color: "#111827", flexShrink: 1, textAlign: "right" },
  bold: { fontWeight: "bold", fontSize: 16, color: "#111827" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 6 },
  warning: { backgroundColor: "#FEF3C7", padding: 12, borderRadius: 8, marginBottom: 12 },
  warningText: { color: "#92400E" },
  note: { color: "#666", textAlign: "center", marginTop: 10 },
  errorText: { color: "#B91C1C", textAlign: "center" },
});
