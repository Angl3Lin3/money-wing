import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import RecipientAvatar from "../components/RecipientAvatar";
import { AppButton, Caption, Card, DetailRow, Divider, Loading, Screen, SectionLabel, TextLink } from "../components/ui";
import { formatCad, formatUgx } from "../constants/format";
import { formatPhone } from "../constants/networks";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
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
    router.push({
      pathname: "/review",
      params: { recipientId: selected.id, cadAmount: quote.cadAmount.toFixed(2) },
    });
  };

  if (loadingRecipients) return <Loading />;

  return (
    <Screen>
      {/* 1. Who */}
      <SectionLabel>Send to</SectionLabel>
      {recipients.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>You don&apos;t have any recipients yet.</Text>
          <AppButton title="+ Add a recipient" variant="secondary" onPress={() => router.push("/add-recipient")} />
        </Card>
      ) : (
        <Card style={styles.recipientCard}>
          {recipients.map((r, index) => {
            const isSelected = selectedId === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setSelectedId(r.id)}
                style={[styles.recipient, index > 0 && styles.recipientBorder, isSelected && styles.recipientSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <RecipientAvatar name={r.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>{r.name}</Text>
                  <Text style={styles.recipientPhone}>
                    {formatPhone(r.phoneNumber)} · {r.network}
                  </Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
          <View style={styles.addLink}>
            <TextLink onPress={() => router.push("/add-recipient")}>+ Add someone new</TextLink>
          </View>
        </Card>
      )}

      {/* 2. How much */}
      <SectionLabel>You send</SectionLabel>
      <Card>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={colors.border}
            value={amount}
            onChangeText={onAmountChange}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount in Canadian dollars"
          />
          <View style={styles.currencyPill}>
            <Text style={styles.currencyCode}>🇨🇦 CAD</Text>
          </View>
        </View>

        <Divider />

        {/* 3. Quote */}
        <View style={styles.quote}>
          {quoting && <ActivityIndicator color={colors.secondary} />}
          {!quoting && quoteError && <Text style={styles.errorText}>{quoteError}</Text>}
          {!quoting && !quoteError && !quote && <Caption>Enter an amount to see how much arrives.</Caption>}
          {!quoting && quote && (
            <>
              <DetailRow label="Fee" value={`− ${formatCad(quote.fee)}`} />
              <DetailRow label="We convert" value={formatCad(quote.cadAmount - quote.fee)} />
              <DetailRow label="Exchange rate" value={`1 CAD = ${formatUgx(quote.exchangeRate)}`} />
            </>
          )}
        </View>

        {quote && !quoting && (
          <View style={styles.receive}>
            <Text style={styles.receiveLabel}>{selected ? `${selected.name} receives` : "They receive"}</Text>
            <Text style={styles.receiveAmount}>{formatUgx(quote.ugxAmount)}</Text>
          </View>
        )}
      </Card>

      <AppButton title="Continue" onPress={onContinue} disabled={!canContinue} />
      {!selected && recipients.length > 0 && <Caption center style={{ marginTop: spacing.sm }}>Choose who you&apos;re sending to.</Caption>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyText: { fontFamily: fonts.regular, color: colors.textMuted, marginBottom: spacing.md },
  recipientCard: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  recipient: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.row,
  },
  recipientBorder: { marginTop: 2 },
  recipientSelected: { backgroundColor: colors.secondarySoft },
  recipientName: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.text },
  recipientPhone: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: colors.secondary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary },
  addLink: { padding: spacing.md },
  // $, the amount and CAD share one fixed line height so they sit on one line.
  amountRow: { flexDirection: "row", alignItems: "center", height: 56, gap: spacing.sm },
  currency: { fontFamily: fonts.bold, fontSize: fontSize["4xl"], lineHeight: 44, color: colors.textSecondary },
  amountInput: {
    flex: 1,
    minWidth: 0, // let it shrink so CAD always fits on the same line
    height: 56,
    fontFamily: fonts.bold,
    fontSize: fontSize["4xl"],
    lineHeight: 44,
    color: colors.text,
    padding: 0,
    outlineStyle: "none" as any,
  },
  currencyPill: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  currencyCode: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.textSecondary },
  quote: { minHeight: 40, justifyContent: "center", paddingVertical: spacing.xs },
  receive: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.row,
    padding: spacing.lg,
  },
  receiveLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.primary },
  receiveAmount: { fontFamily: fonts.bold, fontSize: fontSize["2xl"], color: colors.text, marginTop: 2 },
  errorText: { fontFamily: fonts.medium, color: colors.danger },
});
