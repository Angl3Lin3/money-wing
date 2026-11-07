import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import ProgressTracker, { isFinal } from "../../components/ProgressTracker";
import { AppButton, Badge, Caption, Card, DetailRow, Divider, Loading, Notice, Screen, SectionLabel, Spacer } from "../../components/ui";
import { formatCad, formatUgx } from "../../constants/format";
import { formatPhone } from "../../constants/networks";
import { shortReference, STATUS_INFO } from "../../constants/status";
import { colors, fonts, fontSize, spacing } from "../../constants/theme";
import { confirmAction, showAlert } from "../../services/alert";
import { getErrorMessage, Transaction, transactionAPI } from "../../services/api";

export default function TransferScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const [transfer, setTransfer] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setTransfer(await transactionAPI.get(id));
    } catch (e: any) {
      setError(getErrorMessage(e, "Could not load this transfer."));
    }
  }, [id]);

  // Load now, then keep the tracker up to date until the transfer is finished.
  useEffect(() => {
    load();
  }, [load]);
  const currentStatus = transfer?.status;
  useEffect(() => {
    if (!currentStatus || isFinal(currentStatus)) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [currentStatus, load]);

  const cancel = async () => {
    if (!transfer) return;
    const ok = await confirmAction(
      "Cancel this transfer?",
      `${formatUgx(transfer.ugxAmount)} to ${transfer.recipient.name} won't be sent. You haven't paid for it, so you won't be charged.`,
      "Cancel transfer"
    );
    if (!ok) return;
    setCancelling(true);
    try {
      await transactionAPI.cancel(transfer.id);
      await load();
    } catch (e: any) {
      showAlert("Could not cancel", getErrorMessage(e, "Please try again."));
      await load();
    } finally {
      setCancelling(false);
    }
  };

  const sendAgain = () => {
    if (!transfer) return;
    router.push({
      pathname: "/send",
      params: { recipientId: transfer.recipientId ?? "", amount: transfer.cadAmount.toFixed(2) },
    });
  };

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
      {created === "1" && transfer.status === "DRAFT" && <Notice tone="success">Transfer created. It will be sent once it&apos;s paid.</Notice>}

      <Card style={styles.summary}>
        <Text style={styles.summaryLabel}>{transfer.recipient.name} receives</Text>
        <Text style={styles.summaryAmount}>{formatUgx(transfer.ugxAmount)}</Text>
        <Spacer size={spacing.md} />
        <Badge label={status.label} color={status.color} background={status.background} style={{ alignSelf: "center" }} />
      </Card>

      <SectionLabel>Progress</SectionLabel>
      <Card>
        <ProgressTracker transfer={transfer} />
        {!isFinal(transfer.status) && (
          <Caption style={{ marginTop: spacing.md }}>This updates automatically.</Caption>
        )}
      </Card>

      <SectionLabel>Details</SectionLabel>
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
          <AppButton title="Pay" disabled onPress={() => {}} />
          <Caption center style={{ marginTop: spacing.sm }}>Payment options are coming soon.</Caption>
        </View>
      )}

      <AppButton title="Send again" variant="secondary" onPress={sendAgain} />
      <Caption center style={{ marginTop: 4, marginBottom: spacing.md }}>Same person and amount, at today&apos;s rate.</Caption>

      {transfer.canCancel && (
        <>
          <AppButton title="Cancel transfer" variant="danger" onPress={cancel} loading={cancelling} />
          <Spacer size={spacing.md} />
        </>
      )}

      <AppButton title="Back to home" variant="ghost" onPress={() => router.replace("/dashboard")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { alignItems: "center" },
  summaryLabel: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.textMuted },
  summaryAmount: { fontFamily: fonts.bold, fontSize: fontSize["4xl"], color: colors.text, marginTop: spacing.xs },
});
