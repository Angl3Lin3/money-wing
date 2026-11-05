// Shared building blocks so every screen looks the same.
import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { DEMO_MESSAGE, IS_DEMO } from "../constants/demo";
import { colors, fonts, fontSize, radius, shadow, spacing } from "../constants/theme";

// ---------- Layout ----------

// Scrollable page with the light grey background, centered and width-limited
// so it also looks right in a wide browser window.
export function Screen({ children, center }: { children: ReactNode; center?: boolean }) {
  return (
    <View style={styles.screen}>
      {IS_DEMO && <DemoBanner />}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, center && styles.screenCenter]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.screenInner}>{children}</View>
      </ScrollView>
    </View>
  );
}

// Thin gold strip under the header while the app isn't live.
export function DemoBanner() {
  return (
    <View style={styles.demoBanner} accessibilityRole="alert">
      <Text style={styles.demoText}>{DEMO_MESSAGE}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.secondary} size="large" />
    </View>
  );
}

// ---------- Text ----------

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; center?: boolean };

export function Title({ children, style, center }: TextProps) {
  return <Text style={[styles.title, center && styles.center, style]}>{children}</Text>;
}

export function Subtitle({ children, style, center }: TextProps) {
  return <Text style={[styles.subtitle, center && styles.center, style]}>{children}</Text>;
}

export function Body({ children, style, center }: TextProps) {
  return <Text style={[styles.body, center && styles.center, style]}>{children}</Text>;
}

export function Caption({ children, style, center }: TextProps) {
  return <Text style={[styles.caption, center && styles.center, style]}>{children}</Text>;
}

export function SectionLabel({ children, style }: TextProps) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function TextLink({ children, onPress, center }: { children: ReactNode; onPress: () => void; center?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
      <Text style={[styles.link, center && styles.center]}>{children}</Text>
    </Pressable>
  );
}

// ---------- Buttons ----------

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({ title, onPress, variant = "primary", loading, disabled, style }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === "secondary" && [styles.buttonOutline, pressed && { backgroundColor: colors.secondarySoft }],
        variant === "ghost" && [styles.buttonGhost, pressed && { backgroundColor: colors.border }],
        variant === "danger" && [styles.buttonDanger, pressed && { backgroundColor: colors.dangerSoft }],
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onPrimary : colors.secondary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "primary" && { color: colors.onPrimary },
            variant === "secondary" && { color: colors.secondary },
            variant === "ghost" && { color: colors.textSecondary },
            variant === "danger" && { color: colors.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// ---------- Inputs ----------

type FieldProps = TextInputProps & { label?: string; hint?: string; right?: ReactNode };

// Labeled text input with the blue focus border from the design system.
export function TextField({ label, hint, right, style, onFocus, onBlur, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label && <Text style={styles.fieldLabel}>{label}</Text>}
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <TextInput
          {...props}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {right}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

// ---------- Small pieces ----------

export function Badge({ label, color, background, style }: { label: string; color: string; background: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// "Label ........ value" line used in quotes and receipts.
export function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  const palette = {
    info: [colors.secondarySoft, colors.secondary],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette[0] }]}>
      <Text style={[styles.noticeText, { color: palette[1] }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  demoBanner: { backgroundColor: colors.accent, paddingVertical: 6, paddingHorizontal: spacing.lg },
  demoText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text, textAlign: "center" },
  screenContent: { flexGrow: 1, padding: spacing.xl, alignItems: "center" },
  screenCenter: { justifyContent: "center" },
  screenInner: { width: "100%", maxWidth: 480 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadow,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },

  title: { fontFamily: fonts.bold, fontSize: fontSize["2xl"], color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.textMuted, marginBottom: spacing.lg },
  body: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  link: { fontFamily: fonts.semibold, fontSize: fontSize.base, color: colors.secondary },
  center: { textAlign: "center" },

  button: {
    minHeight: 52,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonOutline: { borderWidth: 1.5, borderColor: colors.secondary, backgroundColor: colors.surface },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDanger: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.surface },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.semibold, fontSize: fontSize.base },

  field: { marginBottom: spacing.lg },
  fieldLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 6 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
  },
  inputBoxFocused: { borderColor: colors.focus },
  input: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.text,
    // remove the browser's own focus outline; the border shows focus instead
    outlineStyle: "none" as any,
  },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 6 },

  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.sm },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: spacing.md },
  rowLabel: { fontFamily: fonts.regular, fontSize: fontSize.base, color: colors.textMuted },
  rowValue: { fontFamily: fonts.medium, fontSize: fontSize.base, color: colors.text, flexShrink: 1, textAlign: "right" },
  rowStrong: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },

  notice: { padding: spacing.md, borderRadius: radius.row, marginBottom: spacing.lg },
  noticeText: { fontFamily: fonts.medium, fontSize: fontSize.sm },
});
