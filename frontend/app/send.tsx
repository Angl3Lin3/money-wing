import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatCad, formatUgx } from "../constants/format";
import { formatPhone } from "../constants/networks";
import { showAlert } from "../services/alert";
import { getErrorMessage, Quote, quoteAPI, Recipient, recipientAPI } from "../services/api";

export default function SendScreen() {
  const params = useLocalSearchParams<{ recipientId?: string }>();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(params.recipientId ?? null);

  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const latestRequest = useRef(0);

  // Load recipients each time the screen is shown (in case one was just added).
  useFocusEffect(
    useCallback(() => {
      recipientAPI
        .list()
        .then((list) => {
          setRecipients(list);
          // Pre-select when there's only one recipient.
          if (list.length === 1) setSelectedId((id) => id ?? list[0].id);
        })
        .catch((e) => showAlert("Error", getErrorMessage(e, "Could not load recipients")))
        .finally(() => setLoadingRecipients(false));
    }, [])
  );

  // Ask the server for a quote shortly after the user stops typing.
  useEffect(() => {
    const value = amount.trim();
    setQuote(null);
    setQuoteError(null);
    if (!value) {
      setQuoting(false);
      return;
    }

    setQuoting(true);
    const requestId = ++latestRequest.current;
    const timer = setTimeout(async () => {
      try {
        const result = await quoteAPI.get(value);
        if (requestId === latestRequest.current) setQuote(result);
      } catch (e: any) {
        if (requestId === latestRequest.current) setQuoteError(getErrorMessage(e, "Could not get a quote"));
      } finally {
        if (requestId === latestRequest.current) setQuoting(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [amount]);

  // Allow only digits and one decimal point with up to 2 decimals.
  const onAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    if (/^\d*(\.\d{0,2})?$/.test(cleaned)) setAmount(cleaned);
  };

  const selected = recipients.find((r) => r.id === selectedId) ?? null;
  const canContinue = Boolean(selected && quote && !quoting);

  const onContinue = () => {
    if (!selected || !quote) return;
    // Next step (3c) will open a review & confirm screen here.
    showAlert(
      "Review coming next",
      `${formatCad(quote.cadAmount)} → ${formatUgx(quote.ugxAmount)} for ${selected.name}.\n\nThe review & confirm screen is the next step to build.`
    );
  };

  if (loadingRecipients) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* 1. Who */}
      <Text style={styles.sectionTitle}>Send to</Text>
      {recipients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>You don&apos;t have any recipients yet.</Text>
          <Button title="+ Add a recipient" onPress={() => router.push("/add-recipient")} />
        </View>
      ) : (
        <>
          {recipients.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setSelectedId(r.id)}
              style={[styles.recipient, selectedId === r.id && styles.recipientSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedId === r.id }}
            >
              <View style={[styles.radio, selectedId === r.id && styles.radioSelected]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recipientName}>{r.name}</Text>
                <Text style={styles.recipientPhone}>
                  {formatPhone(r.phoneNumber)} · {r.network}
                </Text>
              </View>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push("/add-recipient")}>
            <Text style={styles.link}>+ Add someone new</Text>
          </Pressable>
        </>
      )}

      {/* 2. How much */}
      <Text style={styles.sectionTitle}>Amount</Text>
      <View style={styles.amountRow}>
        <Text style={styles.currency}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount in Canadian dollars"
        />
        <Text style={styles.currencyCode}>CAD</Text>
      </View>

      {/* 3. Quote */}
      <View style={styles.quoteBox}>
        {quoting && <ActivityIndicator />}
        {!quoting && quoteError && <Text style={styles.errorText}>{quoteError}</Text>}
        {!quoting && !quoteError && !quote && <Text style={styles.hint}>Enter an amount to see the quote.</Text>}
        {!quoting && quote && (
          <>
            <QuoteRow label="You send" value={formatCad(quote.cadAmount)} />
            <QuoteRow label="Fee" value={`− ${formatCad(quote.fee)}`} />
            <QuoteRow label="We convert" value={formatCad(quote.cadAmount - quote.fee)} />
            <QuoteRow label="Exchange rate" value={`1 CAD = ${formatUgx(quote.exchangeRate)}`} />
            <View style={styles.divider} />
            <QuoteRow label={selected ? `${selected.name} gets` : "Recipient gets"} value={formatUgx(quote.ugxAmount)} bold />
          </>
        )}
      </View>

      <Button title="Continue" onPress={onContinue} disabled={!canContinue} />
      {!selected && recipients.length > 0 && <Text style={styles.hintCenter}>Choose who you&apos;re sending to.</Text>}
    </ScrollView>
  );
}

function QuoteRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.quoteRow}>
      <Text style={[styles.quoteLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.quoteValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginTop: 10, marginBottom: 8 },
  emptyBox: { padding: 16, backgroundColor: "#F9FAFB", borderRadius: 8, gap: 10 },
  emptyText: { color: "#666" },
  recipient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginBottom: 8,
  },
  recipientSelected: { borderColor: "#1E40AF", backgroundColor: "#EFF6FF" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#9CA3AF", marginRight: 12 },
  radioSelected: { borderColor: "#1E40AF", backgroundColor: "#1E40AF" },
  recipientName: { fontSize: 16, fontWeight: "600" },
  recipientPhone: { color: "#666", marginTop: 2 },
  link: { color: "#1E40AF", marginBottom: 10, marginTop: 2 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currency: { fontSize: 22, color: "#444" },
  amountInput: { flex: 1, fontSize: 22, paddingVertical: 10, paddingHorizontal: 6 },
  currencyCode: { color: "#666", fontWeight: "600" },
  quoteBox: { marginVertical: 16, padding: 14, backgroundColor: "#F9FAFB", borderRadius: 8, minHeight: 60, justifyContent: "center" },
  quoteRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  quoteLabel: { color: "#4B5563" },
  quoteValue: { color: "#111827" },
  bold: { fontWeight: "bold", fontSize: 16, color: "#111827" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 6 },
  hint: { color: "#666" },
  hintCenter: { color: "#666", textAlign: "center", marginTop: 8 },
  errorText: { color: "#B91C1C" },
});
