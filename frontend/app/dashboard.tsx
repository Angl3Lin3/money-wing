import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton, Caption, Card, Loading, Screen, Spacer } from "../components/ui";
import { formatUgx } from "../constants/format";
import { colors, fonts, fontSize, radius, shadow, spacing } from "../constants/theme";
import { quoteAPI, userAPI } from "../services/api";
import { clearToken } from "../services/auth-storage";

export default function DashboardScreen() {
    const [email, setEmail] = useState<string | null>(null);
    const [rate, setRate] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const logout = async () => {
        await clearToken();
        router.replace("/");
    };

    useEffect(() => {
        userAPI.getProfile()
            .then((profile) => setEmail(profile.email ?? profile.user?.email ?? null))
            .catch(async (error: any) => {
                // Token missing, expired or invalid: back to the start.
                if (error.response?.status === 401 || error.response?.status === 403) {
                    await logout();
                }
            })
            .finally(() => setLoading(false));

        // Show today's rate (a quote for any valid amount includes it).
        quoteAPI.get("100").then((q) => setRate(q.exchangeRate)).catch(() => {});
    }, []);

    if (loading) return <Loading />;

    return (
        <Screen>
            <View style={styles.hero}>
                <Text style={styles.heroHello}>Hello 👋</Text>
                {email && <Text style={styles.heroEmail}>{email}</Text>}
                {rate && (
                    <View style={styles.ratePill}>
                        <Text style={styles.rateText}>Today: 1 CAD = {formatUgx(rate)}</Text>
                    </View>
                )}
            </View>

            <Pressable
                onPress={() => router.push("/send")}
                style={({ pressed }) => [styles.sendCard, pressed && { backgroundColor: colors.primaryPressed }]}
                accessibilityRole="button"
            >
                <Text style={styles.sendIcon}>➜</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sendTitle}>Send money</Text>
                    <Text style={styles.sendText}>To MTN or Airtel Mobile Money in Uganda</Text>
                </View>
            </Pressable>

            <Card style={styles.menuCard}>
                <MenuItem icon="👥" title="Recipients" subtitle="People you send money to" onPress={() => router.push("/recipients")} />
            </Card>

            <Spacer size={spacing.sm} />
            <AppButton title="Log out" variant="ghost" onPress={logout} />
            <Caption center style={{ marginTop: spacing.sm }}>Transfer history is coming soon.</Caption>
        </Screen>
    );
}

function MenuItem({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]} accessibilityRole="button">
            <View style={styles.menuIcon}><Text style={{ fontSize: 20 }}>{icon}</Text></View>
            <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>{title}</Text>
                <Text style={styles.menuSubtitle}>{subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hero: {
        backgroundColor: colors.secondary,
        borderRadius: radius.card,
        padding: spacing.xl,
        marginBottom: spacing.lg,
    },
    heroHello: { fontFamily: fonts.bold, fontSize: fontSize["2xl"], color: "#fff" },
    heroEmail: { fontFamily: fonts.regular, fontSize: fontSize.base, color: "#cfe0f3", marginTop: 2 },
    ratePill: {
        alignSelf: "flex-start",
        backgroundColor: colors.accent,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        marginTop: spacing.lg,
    },
    rateText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.text },
    sendCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
        backgroundColor: colors.primary,
        borderRadius: radius.card,
        padding: spacing.xl,
        marginBottom: spacing.lg,
        ...shadow,
    },
    sendIcon: { fontSize: 28, color: "#fff" },
    sendTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: "#fff" },
    sendText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: "#ffe2d4", marginTop: 2 },
    menuCard: { paddingVertical: spacing.sm },
    menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
    menuIcon: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.secondarySoft,
        alignItems: "center", justifyContent: "center",
    },
    menuTitle: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.text },
    menuSubtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    chevron: { fontFamily: fonts.regular, fontSize: 28, color: colors.textMuted },
});
