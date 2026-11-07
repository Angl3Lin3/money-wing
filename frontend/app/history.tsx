import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import RecipientAvatar from "../components/RecipientAvatar";
import { AppButton, Badge, Body, Card, Loading, Notice, Screen, SectionLabel, Subtitle, Title } from "../components/ui";
import { formatCad, formatUgx } from "../constants/format";
import { shortReference, STATUS_INFO } from "../constants/status";
import { colors, fonts, fontSize, spacing } from "../constants/theme";
import { getErrorMessage, Transaction, transactionAPI } from "../services/api";

// "Today", "Yesterday", or a date like "Mon, Oct 27, 2026".
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Split a newest-first list into [day label, transfers] groups.
function groupByDay(list: Transaction[]): [string, Transaction[]][] {
  const groups: [string, Transaction[]][] = [];
  for (const t of list) {
    const label = dayLabel(t.createdAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(t);
    else groups.push([label, [t]]);
  }
  return groups;
}

export default function HistoryScreen() {
  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload whenever the screen is shown, so new transfers and status changes appear.
  useFocusEffect(
    useCallback(() => {
      setError(null);
      transactionAPI
        .list()
        .then((page) => {
          setTransfers(page.transactions);
          setHasMore(page.hasMore);
        })
        .catch((e) => setError(getErrorMessage(e, "Could not load your transfers")))
        .finally(() => setLoading(false));
    }, [])
  );

  const loadMore = async () => {
    const oldest = transfers[transfers.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const page = await transactionAPI.list(oldest.createdAt, oldest.id);
      setTransfers((list) => [...list, ...page.transactions]);
      setHasMore(page.hasMore);
    } catch (e: any) {
      setError(getErrorMessage(e, "Could not load more transfers"));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen>
      <Title>Transfer history</Title>
      <Subtitle>Every transfer you&apos;ve made, newest first.</Subtitle>

      {error && <Notice tone="danger">{error}</Notice>}

      {transfers.length === 0 && !error ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyTitle}>No transfers yet</Text>
          <Body center style={{ marginBottom: spacing.lg }}>When you send money, it will show up here.</Body>
          <AppButton title="Send money" onPress={() => router.push("/send")} style={{ alignSelf: "stretch" }} />
        </Card>
      ) : (
        groupByDay(transfers).map(([label, items]) => (
          <View key={label}>
            <SectionLabel>{label}</SectionLabel>
            <Card style={styles.group}>
              {items.map((t, index) => {
                const status = STATUS_INFO[t.status];
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: t.id } })}
                    style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatUgx(t.ugxAmount)} to ${t.recipient.name}, ${status.label}`}
                  >
                    <RecipientAvatar name={t.recipient.name} size={40} />
                    <View style={styles.middle}>
                      <Text style={styles.name} numberOfLines={1}>{t.recipient.name}</Text>
                      <Text style={styles.meta}>
                        {new Date(t.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} ·{" "}
                        {shortReference(t.id)}
                      </Text>
                      <Badge label={status.label} color={status.color} background={status.background} style={styles.badge} />
                    </View>
                    <View style={styles.amounts}>
                      <Text style={styles.ugx}>{formatUgx(t.ugxAmount)}</Text>
                      <Text style={styles.cad}>{formatCad(t.cadAmount)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))
      )}

      {hasMore && (
        <AppButton title="Load older transfers" variant="secondary" onPress={loadMore} loading={loadingMore} />
      )}
      {loadingMore && <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.secondary} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", gap: spacing.sm },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  group: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  middle: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  badge: { marginTop: 6 },
  amounts: { alignItems: "flex-end" },
  ugx: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.text },
  cad: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
});
