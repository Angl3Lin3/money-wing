import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, Badge, Caption, Card, DetailRow, Divider, Loading, Notice, Screen, SectionLabel, TextField, Title } from "../components/ui";
import { API_BASE_URL } from "./constants/config";
import { formatCad, formatUgx } from "../constants/format";
import { formatPhone } from "../constants/networks";
import { shortReference, STATUS_INFO } from "../constants/status";
import { colors, fonts, fontSize, radius, spacing } from "../constants/theme";
import {
  Activity,
  AdminTransaction,
  AdminUser,
  adminAPI,
  AuditEntry,
  Overview,
  Pricing,
  PricingInfo,
  TransferActionName,
  TransferActionRule,
} from "../services/admin-api";
import { confirmAction } from "../services/alert";
import { getErrorMessage, TransactionStatus } from "../services/api";
import { clearDevToken } from "../services/auth-storage";

type Tab = "overview" | "owner" | "checks" | "transfers" | "users" | "emails" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "owner", label: "Owner controls" },
  { key: "checks", label: "API checks" },
  { key: "transfers", label: "Transfers" },
  { key: "users", label: "Users" },
  { key: "emails", label: "Emails" },
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
  const [emails, setEmails] = useState<EmailsData | null>(null);
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
      if (tab === "emails") setEmails(await adminAPI.emails());
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
    if (tab === "checks" || tab === "owner") return; // these manage their own loading
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

      {tab !== "checks" && tab !== "owner" && (
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
      {tab === "owner" && <OwnerTab />}
      {tab === "checks" && <ChecksTab />}
      {tab === "transfers" && (
        <TransfersTab data={transfers} filter={statusFilter} onFilter={setStatusFilter} onChanged={load} />
      )}
      {tab === "users" && (users ? <UsersTab data={users} /> : <Loading />)}
      {tab === "emails" && (emails ? <EmailsTab data={emails} /> : <Loading />)}
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
  onChanged,
}: {
  data: AdminTransaction[] | null;
  filter?: TransactionStatus;
  onFilter: (s?: TransactionStatus) => void;
  onChanged: () => void;
}) {
  const statuses = Object.keys(STATUS_INFO) as TransactionStatus[];
  const [openId, setOpenId] = useState<string | null>(null);
  const [rules, setRules] = useState<TransferActionRule[]>([]);

  useEffect(() => {
    adminAPI.transferActions().then(setRules).catch(() => setRules([]));
  }, []);

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
            <View key={t.id} style={i > 0 && styles.rowBorder}>
              <Pressable
                onPress={() => setOpenId(openId === t.id ? null : t.id)}
                style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityState={{ expanded: openId === t.id }}
              >
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
                    {t.providerPayoutRef ? ` · Ref ${t.providerPayoutRef}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Badge label={STATUS_INFO[t.status].label} color={STATUS_INFO[t.status].color} background={STATUS_INFO[t.status].background} />
                  <Text style={styles.manage}>{openId === t.id ? "Close ▲" : "Manage ▼"}</Text>
                </View>
              </Pressable>
              {openId === t.id && (
                <TransferPanel
                  transfer={t}
                  rules={rules.filter((r) => r.from.includes(t.status))}
                  onChanged={onChanged}
                />
              )}
            </View>
          ))}
        </Card>
      )}
      <Caption center>Showing the latest 20. Tap a transfer to manage it.</Caption>
    </>
  );
}

const ACTION_LABELS: Record<TransferActionName, { title: string; variant: "primary" | "secondary" | "ghost" | "danger"; help: string }> = {
  start_payout: { title: "Start sending", variant: "primary", help: "You're sending the mobile money now." },
  mark_delivered: { title: "Mark delivered", variant: "primary", help: "The money arrived. Enter the MTN/Airtel transaction reference." },
  retry_payout: { title: "Retry sending", variant: "secondary", help: "Try sending again." },
  mark_failed: { title: "Mark failed", variant: "danger", help: "Sending didn't work. Enter the reason." },
  cancel: { title: "Cancel transfer", variant: "danger", help: "Stops a transfer that hasn't been paid for." },
  simulate_payment: { title: "Simulate payment (testing only)", variant: "ghost", help: "Pretends the card payment went through, so you can test payouts before Stripe is connected." },
};

// Actions and history for one transfer.
function TransferPanel({ transfer, rules, onChanged }: { transfer: AdminTransaction; rules: TransferActionRule[]; onChanged: () => void }) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<TransferActionName | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);

  const loadHistory = useCallback(() => {
    adminAPI.audit(transfer.id).then(setHistory).catch(() => setHistory([]));
  }, [transfer.id]);
  useEffect(loadHistory, [loadHistory]);

  const needsReference = rules.some((r) => r.needs === "reference");
  const needsNote = rules.some((r) => r.needs === "note");

  const run = async (rule: TransferActionRule) => {
    const label = ACTION_LABELS[rule.action];
    if (rule.needs === "reference" && !reference.trim()) {
      setMessage({ tone: "danger", text: "Enter the mobile money reference first." });
      return;
    }
    if (rule.needs === "note" && !note.trim()) {
      setMessage({ tone: "danger", text: "Enter a reason first." });
      return;
    }
    const ok = await confirmAction(
      label.title,
      `${shortReference(transfer.id)}: ${formatUgx(transfer.ugxAmount)} to ${transfer.recipient.name}.\n\nStatus will change to "${STATUS_INFO[rule.to].label}".`,
      "Confirm"
    );
    if (!ok) return;

    setBusy(rule.action);
    setMessage(null);
    try {
      await adminAPI.doTransferAction(transfer.id, rule.action, {
        ...(rule.needs === "reference" && { reference }),
        ...(rule.needs === "note" && { note }),
      });
      setMessage({ tone: "success", text: `Done: now "${STATUS_INFO[rule.to].label}".` });
      setReference("");
      setNote("");
      loadHistory();
      onChanged();
    } catch (e: any) {
      setMessage({ tone: "danger", text: getErrorMessage(e, "Could not update the transfer") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.panel}>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {rules.length === 0 ? (
        <Caption>
          {transfer.status === "DRAFT" || transfer.status === "PAYMENT_PENDING"
            ? "Waiting for the customer to pay."
            : "No actions available for this status."}
        </Caption>
      ) : (
        <>
          {needsReference && (
            <TextField
              label="Mobile money reference (for Mark delivered)"
              placeholder="e.g. MP261105.1234.A56789"
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
            />
          )}
          {needsNote && (
            <TextField label="Reason (for Mark failed)" placeholder="e.g. Number not registered for mobile money" value={note} onChangeText={setNote} />
          )}
          {rules.map((rule) => (
            <View key={rule.action} style={{ marginBottom: spacing.sm }}>
              <AppButton
                title={ACTION_LABELS[rule.action].title}
                variant={ACTION_LABELS[rule.action].variant}
                onPress={() => run(rule)}
                loading={busy === rule.action}
                disabled={busy !== null && busy !== rule.action}
              />
              <Caption style={{ marginTop: 4 }}>{ACTION_LABELS[rule.action].help}</Caption>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.rowTitle, { marginTop: spacing.md }]}>History</Text>
      {!history ? (
        <ActivityIndicator color={colors.secondary} />
      ) : history.length === 0 ? (
        <Caption>No owner actions yet.</Caption>
      ) : (
        history.map((e) => <AuditRow key={e.id} entry={e} />)
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ---------- Owner controls ----------

const PRICING_FIELDS: { key: keyof Pricing; label: string; hint: string; prefix?: string; suffix?: string }[] = [
  { key: "exchangeRate", label: "Exchange rate", hint: "How many Ugandan shillings 1 Canadian dollar buys", prefix: "1 CAD =", suffix: "UGX" },
  { key: "feePercent", label: "Fee", hint: "Taken out of the amount the customer sends (0–20)", suffix: "%" },
  { key: "minCad", label: "Minimum transfer", hint: "Smallest amount a customer can send", prefix: "$", suffix: "CAD" },
  { key: "maxCad", label: "Maximum transfer", hint: "Largest amount a customer can send", prefix: "$", suffix: "CAD" },
];

function OwnerTab() {
  const [info, setInfo] = useState<PricingInfo | null>(null);
  const [form, setForm] = useState<Record<keyof Pricing, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [log, setLog] = useState<AuditEntry[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [settings, entries] = await Promise.all([adminAPI.settings(), adminAPI.audit()]);
      setInfo(settings);
      setForm({
        exchangeRate: String(settings.pricing.exchangeRate),
        feePercent: String(settings.pricing.feePercent),
        minCad: String(settings.pricing.minCad),
        maxCad: String(settings.pricing.maxCad),
      });
      setLog(entries);
    } catch (e: any) {
      setMessage({ tone: "danger", text: getErrorMessage(e, "Could not load settings") });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (!info || !form) return message ? <Notice tone={message.tone}>{message.text}</Notice> : <Loading />;

  const values = {
    exchangeRate: Number(form.exchangeRate),
    feePercent: Number(form.feePercent),
    minCad: Number(form.minCad),
    maxCad: Number(form.maxCad),
  };
  const valid = Object.values(values).every((v) => Number.isFinite(v) && v >= 0) && Object.values(form).every((v) => v.trim() !== "");
  const changed = (Object.keys(values) as (keyof Pricing)[]).some((k) => values[k] !== info.pricing[k]);

  // What a $100 transfer would look like with the numbers in the form.
  const previewFee = valid ? Math.round(100 * values.feePercent) / 100 : 0;
  const previewUgx = valid ? Math.floor((100 - previewFee) * values.exchangeRate) : 0;

  const save = async () => {
    const lines = (Object.keys(values) as (keyof Pricing)[])
      .filter((k) => values[k] !== info.pricing[k])
      .map((k) => `${PRICING_FIELDS.find((f) => f.key === k)!.label}: ${info.pricing[k]} → ${values[k]}`)
      .join("\n");
    const ok = await confirmAction("Save new pricing?", `${lines}\n\nNew quotes will use these numbers straight away.`, "Save");
    if (!ok) return;

    setSaving(true);
    setMessage(null);
    try {
      await adminAPI.savePricing(values);
      setMessage({ tone: "success", text: "Saved. New quotes now use these numbers." });
      await load();
    } catch (e: any) {
      setMessage({ tone: "danger", text: getErrorMessage(e, "Could not save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionLabel>Rate, fee and limits</SectionLabel>
      <Card>
        <Caption style={{ marginBottom: spacing.md }}>
          {info.source === "owner"
            ? `Last changed by ${info.updatedBy} on ${new Date(info.updatedAt!).toLocaleString()}.`
            : "Not set yet: using the defaults from backend/.env."}
        </Caption>

        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        {PRICING_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={`${f.label}${f.suffix ? ` (${f.suffix})` : ""}`}
            hint={f.hint}
            value={form[f.key]}
            onChangeText={(text) => setForm({ ...form, [f.key]: text.replace(/[^0-9.]/g, "") })}
            keyboardType="decimal-pad"
          />
        ))}

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Preview: customer sends $100.00</Text>
          <Text style={styles.previewValue}>
            {valid ? `Fee ${formatCad(previewFee)} · recipient gets ${formatUgx(previewUgx)}` : "Fill in all fields"}
          </Text>
        </View>

        <AppButton title="Save pricing" onPress={save} loading={saving} disabled={!valid || !changed} />
        {!changed && <Caption center style={{ marginTop: spacing.sm }}>No changes yet.</Caption>}
      </Card>

      <SectionLabel>Recent owner actions</SectionLabel>
      <Card>
        {!log ? <Loading /> : log.length === 0 ? <Caption>Nothing yet.</Caption> : log.map((e) => <AuditRow key={e.id} entry={e} />)}
      </Card>
      <Caption center>Every change is recorded permanently with who made it.</Caption>
    </>
  );
}

// One line of the owner action log, in plain words.
function describeAudit(e: AuditEntry): string {
  const d = e.details ?? {};
  if (e.action === "pricing.update") {
    const keys: (keyof Pricing)[] = ["exchangeRate", "feePercent", "minCad", "maxCad"];
    const names = { exchangeRate: "rate", feePercent: "fee %", minCad: "min $", maxCad: "max $" };
    const parts = keys.filter((k) => d.before?.[k] !== d.after?.[k]).map((k) => `${names[k]} ${d.before?.[k]} → ${d.after?.[k]}`);
    return `Changed pricing: ${parts.join(", ") || "no change"}`;
  }
  const ref = e.targetId ? shortReference(e.targetId) : "";
  const to = d.to && STATUS_INFO[d.to as TransactionStatus] ? STATUS_INFO[d.to as TransactionStatus].label : d.to;
  const verb: Record<string, string> = {
    "transfer.simulate_payment": "Simulated payment for",
    "transfer.start_payout": "Started sending",
    "transfer.mark_delivered": "Marked delivered",
    "transfer.mark_failed": "Marked failed",
    "transfer.retry_payout": "Retried sending",
    "transfer.cancel": "Cancelled",
    "transfer.customer_cancel": "Customer cancelled",
    "transfer.payment_started": "Card payment started for",
    "transfer.payment_received": "Payment received for",
    "transfer.payment_failed": "Payment failed for",
    "transfer.payout_started": "Automatic payout started for",
    "transfer.payout_completed": "Automatic payout delivered",
    "transfer.payout_failed": "Automatic payout failed for",
  };
  return `${verb[e.action] ?? e.action} ${ref} → ${to}${d.reference ? ` (ref ${d.reference})` : ""}${d.note ? `: ${d.note}` : ""}`;
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <View style={styles.auditRow}>
      <Text style={styles.auditText}>{describeAudit(entry)}</Text>
      <Text style={styles.rowSub}>
        {entry.actorEmail} · {new Date(entry.createdAt).toLocaleString()}
      </Text>
    </View>
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

// ---------- Emails ----------

type EmailsData = Awaited<ReturnType<typeof adminAPI.emails>>;

function EmailsTab({ data }: { data: EmailsData }) {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <>
      <Notice tone={data.configured ? "success" : "info"}>
        {data.configured
          ? `Email is set up (${data.setup}). Emails are really sent; their contents aren't kept here.`
          : "No email service is set up, so emails aren't sent. They're shown here instead. Tap one to read it (codes included)."}
      </Notice>
      <Card>
        {data.emails.length === 0 ? (
          <Caption>No emails since the server started.</Caption>
        ) : (
          data.emails.map((e, i) => {
            const tone =
              e.status === "sent"
                ? { color: colors.success, background: colors.successSoft, label: "Sent" }
                : e.status === "failed"
                ? { color: colors.danger, background: colors.dangerSoft, label: "Failed" }
                : { color: colors.secondary, background: colors.secondarySoft, label: "Not sent" };
            return (
              <View key={e.id} style={i > 0 && styles.rowBorder}>
                <Pressable
                  onPress={() => setOpenId(openId === e.id ? null : e.id)}
                  disabled={!e.text && !e.error}
                  style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{e.subject}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>To {e.to} · {timeAgo(e.time)}</Text>
                  </View>
                  <Badge label={tone.label} color={tone.color} background={tone.background} />
                </Pressable>
                {openId === e.id && (
                  <View style={styles.panel}>
                    {e.error && <Text style={styles.logError}>{e.error}</Text>}
                    {e.text && <Text style={styles.emailText}>{e.text}</Text>}
                  </View>
                )}
              </View>
            );
          })
        )}
      </Card>
      <Caption center>The last 50 emails since the server started.</Caption>
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
  manage: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.secondary },
  panel: { backgroundColor: colors.background, borderRadius: radius.row, padding: spacing.lg, marginBottom: spacing.md },
  preview: { backgroundColor: colors.primarySoft, borderRadius: radius.row, padding: spacing.md, marginBottom: spacing.lg },
  previewLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.primary },
  previewValue: { fontFamily: fonts.bold, fontSize: fontSize.base, color: colors.text, marginTop: 2 },
  auditRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  auditText: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.text },
  emailText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
});
