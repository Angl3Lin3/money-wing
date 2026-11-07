import { StyleSheet, Text, View } from "react-native";
import { formatUgx } from "../constants/format";
import { colors, fonts, fontSize, spacing } from "../constants/theme";
import type { Transaction, TransactionStatus } from "../services/api";

type StepState = "done" | "current" | "upcoming" | "failed";
interface Step {
  title: string;
  description: string;
  state: StepState;
  at?: string;
}

// Latest time the transfer reached a status, from its timeline.
const timeOf = (t: Transaction, status: TransactionStatus) =>
  [...(t.timeline ?? [])].reverse().find((s) => s.status === status)?.at;

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : undefined;

// Works out the steps to show for a transfer's current status.
function buildSteps(t: Transaction): Step[] {
  const name = t.recipient.name;
  const created: Step = { title: "Transfer created", description: "We have your transfer details.", state: "done", at: t.createdAt };

  if (t.status === "CANCELLED") {
    return [created, { title: "Cancelled", description: "This transfer was cancelled. You haven't been charged.", state: "failed", at: timeOf(t, "CANCELLED") }];
  }
  if (t.status === "FAILED") {
    return [created, { title: "Payment failed", description: "The payment didn't go through, so nothing was sent.", state: "failed", at: timeOf(t, "FAILED") }];
  }

  const rank: Record<string, number> = { DRAFT: 0, PAYMENT_PENDING: 0, FUNDED: 1, PAYOUT_PENDING: 2, PAYOUT_FAILED: 2, COMPLETED: 3 };
  const r = rank[t.status] ?? 0;

  const paid: Step =
    r >= 1
      ? { title: "Payment received", description: "Thanks! Your payment arrived.", state: "done", at: timeOf(t, "FUNDED") }
      : t.status === "PAYMENT_PENDING"
      ? { title: "Payment processing", description: "We're confirming your payment.", state: "current" }
      : { title: "Waiting for payment", description: "Your transfer will be sent once it's paid.", state: "current" };

  const failedNote = [...(t.timeline ?? [])].reverse().find((s) => s.status === "PAYOUT_FAILED")?.note;
  const sending: Step =
    r >= 3
      ? { title: "Sent to Uganda", description: `Sent to ${name}'s ${t.recipient.network} Mobile Money.`, state: "done", at: timeOf(t, "PAYOUT_PENDING") }
      : t.status === "PAYOUT_FAILED"
      ? {
          title: "Delivery problem",
          description: `We couldn't deliver it yet${failedNote ? `: ${failedNote}` : ""}. We'll be in touch.`,
          state: "failed",
          at: timeOf(t, "PAYOUT_FAILED"),
        }
      : t.status === "PAYOUT_PENDING"
      ? { title: "Sending to Uganda", description: `We're sending the money to ${name}'s ${t.recipient.network} wallet.`, state: "current", at: timeOf(t, "PAYOUT_PENDING") }
      : { title: "Sending to Uganda", description: `To ${name}'s ${t.recipient.network} Mobile Money.`, state: "upcoming" };

  const delivered: Step =
    t.status === "COMPLETED"
      ? { title: "Delivered", description: `${name} received ${formatUgx(t.ugxAmount)}.`, state: "done", at: timeOf(t, "COMPLETED") }
      : { title: "Delivered", description: `${name} receives ${formatUgx(t.ugxAmount)}.`, state: "upcoming" };

  return [created, paid, sending, delivered];
}

const DOT: Record<StepState, { bg: string; border: string; symbol: string; symbolColor: string }> = {
  done: { bg: colors.success, border: colors.success, symbol: "✓", symbolColor: "#fff" },
  current: { bg: colors.surface, border: colors.primary, symbol: "", symbolColor: colors.primary },
  upcoming: { bg: colors.surface, border: colors.border, symbol: "", symbolColor: colors.textMuted },
  failed: { bg: colors.danger, border: colors.danger, symbol: "!", symbolColor: "#fff" },
};

// Vertical step-by-step view of where a transfer is.
export default function ProgressTracker({ transfer }: { transfer: Transaction }) {
  const steps = buildSteps(transfer);
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const dot = DOT[step.state];
        const last = i === steps.length - 1;
        return (
          <View key={step.title} style={styles.row} accessibilityLabel={`${step.title}. ${step.description}`}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dot.bg, borderColor: dot.border }]}>
                {step.state === "current" ? <View style={styles.pulse} /> : <Text style={[styles.symbol, { color: dot.symbolColor }]}>{dot.symbol}</Text>}
              </View>
              {!last && <View style={[styles.line, step.state === "done" && { backgroundColor: colors.success }]} />}
            </View>
            <View style={[styles.text, !last && { paddingBottom: spacing.lg }]}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, step.state === "upcoming" && { color: colors.textMuted }, step.state === "failed" && { color: colors.danger }]}>
                  {step.title}
                </Text>
                {when(step.at) && <Text style={styles.time}>{when(step.at)}</Text>}
              </View>
              <Text style={styles.description}>{step.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Whether a transfer is finished (no point refreshing any more).
export const isFinal = (status: TransactionStatus) => status === "COMPLETED" || status === "CANCELLED" || status === "FAILED";

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  rail: { width: 28, alignItems: "center" },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  symbol: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  text: { flex: 1, paddingLeft: spacing.md },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.sm },
  title: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.text, flexShrink: 1 },
  time: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  description: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
});
