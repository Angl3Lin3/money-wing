import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, Badge, Caption, Card, DetailRow, Divider, Loading, Notice, Screen, SectionLabel, Title } from "../components/ui";
import { API_BASE_URL } from "./constants/config";
import { formatCad, formatUgx } from "../constants/format";
import { formatPhone } from "../constants/networks";
import { shortReference, STATUS_INFO } from "../constants/status";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
import { Activity, AdminTransaction, AdminUser, adminAPI, Overview } from "../services/admin-api";
import { getErrorMessage, TransactionStatus } from "../services/api";
import { clearDevToken } from "../services/auth-storage";

type Tab = "overview" | "checks" | "transfers" | "users" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "checks", label: "API checks" },
  { key: "transfers", label: "Transfers" },
  { key: "users", label: "Users" },
  { key: "activity", label: "Activity" },
];

const REFRESH_SECONDS = 15;

const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
};

const formatUptime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};

export default function DevDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [transfers, setTransfers] = useState<AdminTransaction[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | undefined>(undefined);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const logout = useCallback(async () => {
    await clearDevToken();
    router.replace("/dev-login");
  }, []);

  // Load whatever the current tab needs.
  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (tab === "overview") setOverview(await adminAPI.overview());
      if (tab === "transfers") setTransfers(await adminAPI.transactions(statusFilter));
      if (tab === "users") setUsers(await adminAPI.users());
      if (tab === "activity") setActivity(await adminAPI.activity());
      setUpdatedAt(new Date());
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) return logout(); // not (or no longer) allowed
      setError(getErrorMessage(e, "Could not load data"));
    } finally {
      setRefreshing(false);
    }
  }, [tab, statusFilter, logout]);

  // Load now, then refresh automatically.
  useEffect(() => {
    if (tab === "checks") return;
    load();
    const timer = setInterval(load, REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [tab, load]);

  return (
    <Screen hideDemoBanner>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Title>Developer area</Title>
          <Caption>Server: {API_BASE_URL}</Caption>
        </View>
        <AppButton title="Log out" variant="ghost" onPress={logout} style={styles.logout} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab !== "checks" && (
        <View style={styles.refreshRow}>
          <Caption>
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every ${REFRESH_SECONDS}s` : "Loading..."}
          </Caption>
          <Pressable onPress={load} disabled={refreshing} hitSlop={8}>
            {refreshing ? <ActivityIndicator color={colors.secondary} /> : <Text style={styles.refresh}>Refresh</Text>}
          </Pressable>
        </View>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      {tab === "overview" && (overview ? <OverviewTab data={overview} /> : <Loading />)}
      {tab === "checks" && <ChecksTab />}
      {tab === "transfers" && (
        <TransfersTab data={transfers} filter={statusFilter} onFilter={setStatusFilter} />
      )}
      {tab === "users" && (users ? <UsersTab data={users} /> : <Loading />)}
      {tab === "activity" && (activity ? <ActivityTab data={activity} /> : <Loading />)}
    </Screen>
  );
}

// ---------- Overview ----------

function OverviewTab({ data }: { data: Overview }) {
  const { server, database, config, totals } = data;
  return (
    <>
      <SectionLabel>Health</SectionLabel>
      <View style={styles.tiles}>
        <Tile label="Server" value="Running" sub={`Up ${formatUptime(server.uptimeSeconds)}`} tone="good" />
        <Tile
          label="Database"
          value={database.ok ? "Connected" : "Down"}
          sub={database.ok ? `${database.latencyMs} ms` : database.error}
          tone={database.ok ? "good" : "bad"}
        />
      </View>

      <SectionLabel>Numbers</SectionLabel>
      <View style={styles.tiles}>
        <Tile label="Users" value={String(totals.users.total)} sub={`${totals.users.verified} verified · ${totals.users.pending} pending`} />
        <Tile label="New users (24h)" value={String(totals.users.newLast24h)} />
        <Tile label="Transfers" value={String(totals.transfers.total)} sub={`${totals.transfers.newLast24h} in last 24h`} />
        <Tile label="Recipients" value={String(totals.recipients)} />
        <Tile label="Paid volume" value={formatCad(totals.transfers.paidVolumeCad)} sub="Paid, sending or delivered" />
      </View>

      <SectionLabel>Transfers by status</SectionLabel>
      <Card>
        {(Object.keys(STATUS_INFO) as TransactionStatus[]).map((s) => {
          const entry = totals.transfers.byStatus[s];
          return (
            <View key={s} style={styles.statusRow}>
              <Badge label={STATUS_INFO[s].label} color={STATUS_INFO[s].color} background={STATUS_INFO[s].background} />
              <Text style={styles.statusCount}>
                {entry?.count ?? 0} · {formatCad(entry?.cadAmount ?? 0)}
              </Text>
            </View>
          );
        })}
      </Card>

      <SectionLabel>Settings</SectionLabel>
      <Card>
        <DetailRow label="Exchange rate" value={`1 CAD = ${formatUgx(config.pricing.exchangeRate)}`} />
        <DetailRow label="Fee" value={`${config.pricing.feePercent}%`} />
        <DetailRow label="Limits" value={`${formatCad(config.pricing.minCad)} – ${formatCad(config.pricing.maxCad)}`} />
        <Divider />
        <DetailRow label="Login secret" value={config.jwtSecret} />
        <DetailRow label="Stripe key" value={config.stripeSecretKey} />
        <DetailRow label="Stripe webhook" value={config.stripeWebhookSecret} />
        <DetailRow label="Payouts" value={config.payoutProvider} />
        <DetailRow label="Email" value={config.emailProvider} />
        <DetailRow label="Developers" value={String(config.adminCount)} />
        <Divider />
        <DetailRow label="Node" value={server.nodeVersion} />
        <DetailRow label="Environment" value={server.environment} />
        <DetailRow label="Started" value={new Date(server.startedAt).toLocaleString()} />
      </Card>
    </>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, tone === "good" && { color: colors.success }, tone === "bad" && { color: colors.danger }]}>
        {value}
      </Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

// ---------- API checks ----------

type CheckResult = { ok: boolean; ms: number; detail: string };

function ChecksTab() {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    setResults({});
    for (const check of adminAPI.checks) {
      const start = Date.now();
      try {
        const response: any = await check.run();
        setResults((r) => ({ ...r, [check.name]: { ok: true, ms: Date.now() - start, detail: `HTTP ${response?.status ?? 200}` } }));
      } catch (e: any) {
        const detail = e?.response ? `HTTP ${e.response.status}: ${e.response.data?.error ?? "error"}` : e?.message ?? "No response";
        setResults((r) => ({ ...r, [check.name]: { ok: false, ms: Date.now() - start, detail } }));
      }
    }
    setRunning(false);
  };

  return (
    <>
      <Card>
        <Caption style={{ marginBottom: spacing.md }}>
          Calls the main parts of the server and shows whether each one answers, and how fast.
        </Caption>
        <AppButton title="Run all checks" onPress={runAll} loading={running} />
      </Card>
      <Card>
        {adminAPI.checks.map((check, i) => {
          const r = results[check.name];
          return (
            <View key={check.name} style={[styles.checkRow, i > 0 && styles.rowBorder]}>
              <Text style={[styles.checkIcon, { color: !r ? colors.textMuted : r.ok ? colors.success : colors.danger }]}>
                {!r ? "•" : r.ok ? "✓" : "✕"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{check.name}</Text>
                <Text style={styles.rowSub}>{r ? `${r.detail} · ${r.ms} ms` : "Not run yet"}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

// ---------- Transfers ----------

function TransfersTab({
  data,
  filter,
  onFilter,
}: {
  data: AdminTransaction[] | null;
  filter?: TransactionStatus;
  onFilter: (s?: TransactionStatus) => void;
}) {
  const statuses = Object.keys(STATUS_INFO) as TransactionStatus[];
  return (
    <>
      <View style={styles.filters}>
        <FilterChip label="All" active={!filter} onPress={() => onFilter(undefined)} />
        {statuses.map((s) => (
          <FilterChip key={s} label={STATUS_INFO[s].label} active={filter === s} onPress={() => onFilter(s)} />
        ))}
      </View>
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <Card><Caption>No transfers{filter ? " with this status" : " yet"}.</Caption></Card>
      ) : (
        <Card>
          {data.map((t, i) => (
            <View key={t.id} style={[styles.listRow, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>
                  {formatCad(t.cadAmount)} → {formatUgx(t.ugxAmount)}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {t.user.email} → {t.recipient.name} ({formatPhone(t.recipient.phoneNumber)}, {t.recipient.network})
                </Text>
                <Text style={styles.rowSub}>
                  {shortReference(t.id)} · {timeAgo(t.createdAt)}
                  {t.stripePaymentId ? " · Stripe ✓" : ""}
                </Text>
              </View>
              <Badge label={STATUS_INFO[t.status].label} color={STATUS_INFO[t.status].color} background={STATUS_INFO[t.status].background} />
            </View>
          ))}
        </Card>
      )}
      <Caption center>Showing the latest 20.</Caption>
    </>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------- Users ----------

function UsersTab({ data }: { data: AdminUser[] }) {
  if (data.length === 0) return <Card><Caption>No users yet.</Caption></Card>;
  return (
    <>
      <Card>
        {data.map((u, i) => (
          <View key={u.id} style={[styles.listRow, i > 0 && styles.rowBorder]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.rowSub}>
                Joined {timeAgo(u.createdAt)} · {u._count.recipients} recipients · {u._count.transactions} transfers
              </Text>
            </View>
            <Badge
              label={u.status === "verified" ? "Verified" : "Pending"}
              color={u.status === "verified" ? colors.success : colors.warning}
              background={u.status === "verified" ? colors.successSoft : colors.warningSoft}
            />
          </View>
        ))}
      </Card>
      <Caption center>Showing the latest 20 sign-ups.</Caption>
    </>
  );
}

// ---------- Activity ----------

function ActivityTab({ data }: { data: Activity }) {
  return (
    <>
      <View style={styles.tiles}>
        <Tile label="Requests (1h)" value={String(data.summary.requestsLastHour)} />
        <Tile
          label="Server errors (1h)"
          value={String(data.summary.serverErrorsLastHour)}
          tone={data.summary.serverErrorsLastHour ? "bad" : "good"}
        />
        <Tile label="Avg response (1h)" value={`${data.summary.averageMsLastHour} ms`} />
      </View>

      <SectionLabel>Recent errors</SectionLabel>
      <Card>
        {data.errors.length === 0 ? (
          <Caption>No errors since the server started.</Caption>
        ) : (
          data.errors.slice(0, 20).map((e, i) => (
            <View key={i} style={[styles.logRow, i > 0 && styles.rowBorder]}>
              <Text style={styles.logError}>{e.message}</Text>
              <Text style={styles.rowSub}>{timeAgo(e.time)}</Text>
            </View>
          ))
        )}
      </Card>

      <SectionLabel>Recent requests</SectionLabel>
      <Card>
        {data.requests.length === 0 ? (
          <Caption>No requests yet.</Caption>
        ) : (
          data.requests.slice(0, 50).map((r, i) => (
            <View key={i} style={[styles.requestRow, i > 0 && styles.rowBorder]}>
              <Text style={[styles.code, { color: r.status >= 500 ? colors.danger : r.status >= 400 ? colors.warning : colors.success }]}>
                {r.status}
              </Text>
              <Text style={styles.method}>{r.method}</Text>
              <Text style={styles.path} numberOfLines={1}>{r.path}</Text>
              <Text style={styles.rowSub}>{Math.round(r.durationMs)} ms · {timeAgo(r.time)}</Text>
            </View>
          ))
        )}
      </Card>
      <Caption center>Kept in memory: clears when the server restarts. Request contents are never stored.</Caption>
    </>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  logout: { minHeight: 40, paddingHorizontal: spacing.md },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.dev },
  tabText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.textSecondary },
  tabTextActive: { color: "#fff" },
  refreshRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  refresh: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.secondary },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  tile: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.surface, borderRadius: radius.row, padding: spacing.lg },
  tileLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  tileValue: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.text, marginTop: 2 },
  tileSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  statusCount: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.text },
  checkRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm, alignItems: "center" },
  checkIcon: { fontFamily: fonts.bold, fontSize: fontSize.lg, width: 20, textAlign: "center" },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
  chipTextActive: { color: "#fff", fontFamily: fonts.bold },
  logRow: { paddingVertical: spacing.sm },
  logError: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.danger },
  requestRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  code: { fontFamily: fonts.bold, fontSize: fontSize.sm, width: 32 },
  method: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.textSecondary, width: 52 },
  path: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text, flex: 1, minWidth: 0 },
});
