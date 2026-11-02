import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import RecipientAvatar from "../components/RecipientAvatar";
import { AppButton, Body, Caption, Card, DetailRow, Divider, Loading, Notice, Screen, SectionLabel, Title } from "../components/ui";
import { formatCad, formatUgx } from "../constants/format";
import { formatPhone } from "../constants/networks";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
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
      <Screen center>
        <Notice tone="danger">{loadError}</Notice>
        <AppButton title="Back to Send Money" variant="secondary" onPress={() => router.replace("/send")} />
      </Screen>
    );
  }

  if (!recipient || !quote) return <Loading />;

  return (
    <Screen>
      <Title>Check the details</Title>
      <Body style={{ marginBottom: spacing.lg }}>Make sure everything is right before you confirm.</Body>

      {priceChanged && <Notice tone="warning">The amounts below were updated. Please check them again.</Notice>}

      <SectionLabel>Recipient</SectionLabel>
      <Card style={styles.recipientCard}>
        <RecipientAvatar name={recipient.name} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{recipient.name}</Text>
          <Text style={styles.detail}>{formatPhone(recipient.phoneNumber)}</Text>
          <Text style={styles.detail}>{recipient.network} Mobile Money</Text>
        </View>
      </Card>

      <SectionLabel>Amount</SectionLabel>
      <Card>
        <DetailRow label="You pay" value={formatCad(quote.cadAmount)} />
        <DetailRow label="Fee (included)" value={formatCad(quote.fee)} />
        <DetailRow label="Exchange rate" value={`1 CAD = ${formatUgx(quote.exchangeRate)}`} />
        <Divider />
        <View style={styles.receive}>
          <Text style={styles.receiveLabel}>{recipient.name} receives</Text>
          <Text style={styles.receiveAmount}>{formatUgx(quote.ugxAmount)}</Text>
        </View>
      </Card>

      <AppButton title="Confirm" onPress={confirm} loading={confirming} />
      <Caption center style={{ marginTop: spacing.sm }}>You&apos;ll pay by card in the next step.</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  recipientCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  receive: { marginTop: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.row, padding: spacing.lg },
  receiveLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.primary },
  receiveAmount: { fontFamily: fonts.bold, fontSize: fontSize["2xl"], color: colors.text, marginTop: 2 },
});
