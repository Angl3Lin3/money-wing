import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppButton, Badge, Caption, Card, DetailRow, Divider, Loading, Notice, Screen, Spacer } from "../../components/ui";
import { formatCad, formatUgx } from "../../constants/format";
import { formatPhone } from "../../constants/networks";
import { shortReference, STATUS_INFO } from "../../constants/status";
import { colors, fonts, fontSize, spacing } from "../../constants/theme";
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
      <Screen center>
        <Notice tone="danger">{error}</Notice>
      </Screen>
    );
  }

  if (!transfer) return <Loading />;

  const status = STATUS_INFO[transfer.status];

  return (
    <Screen>
      {created === "1" && <Notice tone="success">Transfer created. Next, pay by card to send it.</Notice>}

      <Card style={styles.summary}>
        <Text style={styles.summaryLabel}>{transfer.recipient.name} receives</Text>
        <Text style={styles.summaryAmount}>{formatUgx(transfer.ugxAmount)}</Text>
        <Spacer size={spacing.md} />
        <Badge label={status.label} color={status.color} background={status.background} style={{ alignSelf: "center" }} />
      </Card>

      <Card>
        <DetailRow label="Reference" value={shortReference(transfer.id)} />
        <DetailRow label="Created" value={new Date(transfer.createdAt).toLocaleString()} />
        <Divider />
        <DetailRow label="Recipient" value={transfer.recipient.name} />
        <DetailRow label="Mobile number" value={formatPhone(transfer.recipient.phoneNumber)} />
        <DetailRow label="Network" value={`${transfer.recipient.network} Mobile Money`} />
        <Divider />
        <DetailRow label="You pay" value={formatCad(transfer.cadAmount)} />
        <DetailRow label="Fee (included)" value={formatCad(transfer.fee)} />
        <DetailRow label="Exchange rate" value={`1 CAD = ${formatUgx(transfer.exchangeRate)}`} />
      </Card>

      {transfer.status === "DRAFT" && (
        <View style={{ marginBottom: spacing.md }}>
          <AppButton title="Pay with card" disabled onPress={() => {}} />
          <Caption center style={{ marginTop: spacing.sm }}>Card payment is the next step to build.</Caption>
        </View>
      )}

      <AppButton title="Back to home" variant="secondary" onPress={() => router.replace("/dashboard")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: "center" },
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.textMuted },
  summaryAmount: { fontFamily: fonts.bold, fontSize: fontSize["4xl"], color: colors.text, marginTop: spacing.xs },
});
