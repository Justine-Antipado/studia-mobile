import { Ionicons } from "@expo/vector-icons";
import { type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { MAX_CONTENT_WIDTH, useResponsive } from "@/shared/hooks/use-responsive";

export type IconName = ComponentProps<typeof Ionicons>["name"];

// ---- layout -------------------------------------------------------------------
/** Centers + caps width on tablets/foldables; consistent vertical rhythm. */
export function Page({ children }: { children: ReactNode }) {
  return <View style={s.page}>{children}</View>;
}

export function PageTitle({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <View style={s.titleRow}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          android_ripple={{ color: C.lavender, borderless: true, radius: 24 }}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={C.primaryDark} />
        </Pressable>
      ) : null}
      <View style={s.titleText}>
        <Text style={s.h1} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.h2}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={s.sectionAction}>
          <Text style={s.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---- pressable surface (ripple on Android, opacity on iOS) -------------------------
function Tappable({ onPress, style, label, children }: {
  onPress?: () => void;
  style: StyleProp<ViewStyle>;
  label?: string;
  children: ReactNode;
}) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: C.lavender }}
      style={({ pressed }) => [style, Platform.OS === "ios" && pressed && s.pressedIos]}
    >
      {children}
    </Pressable>
  );
}

// ---- cards ---------------------------------------------------------------------
export function StatCard({ label, value, tone = "primary", onPress }: {
  label: string;
  value: number | string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const { isCompact } = useResponsive();
  const t = TONES[tone];
  const plain = tone === "primary";
  return (
    <Tappable
      onPress={onPress}
      label={`${label}: ${value}`}
      style={[s.stat, { backgroundColor: plain ? C.white : t.bg, borderColor: plain ? C.border : t.border, padding: isCompact ? 12 : 16 }]}
    >
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[s.statValue, { color: plain ? C.text : t.strong, fontSize: isCompact ? 26 : 32 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </Tappable>
  );
}

export function ListCard({ icon, title, meta, eyebrow, tone = "primary", onPress, trailing }: {
  icon: IconName;
  title: string;
  meta?: string;
  eyebrow?: string;
  tone?: Tone;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const t = TONES[tone];
  const tinted = tone !== "primary";
  return (
    <Tappable
      onPress={onPress}
      label={[eyebrow, title, meta].filter(Boolean).join(", ")}
      style={[s.card, { backgroundColor: tinted ? t.bg : C.white, borderColor: tinted ? t.border : C.border }]}
    >
      <View style={[s.cardIcon, { backgroundColor: tinted ? C.white : C.lavenderSoft }]}>
        <Ionicons name={icon} size={22} color={t.fg} />
      </View>
      <View style={s.cardBody}>
        {eyebrow ? <Text style={[s.eyebrow, { color: t.strong }]} numberOfLines={1}>{eyebrow}</Text> : null}
        <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>
        {meta ? <Text style={s.cardMeta} numberOfLines={2}>{meta}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={C.muted} /> : null)}
    </Tappable>
  );
}

export function QuickAction({ icon, label, tone = "primary", onPress }: {
  icon: IconName;
  label: string;
  tone?: Tone;
  onPress: () => void;
}) {
  const { actionIconSize, isCompact } = useResponsive();
  const t = TONES[tone];
  return (
    <View style={s.qaCell}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={{ color: t.border, borderless: true }}
        style={({ pressed }) => [s.qaPress, Platform.OS === "ios" && pressed && s.pressedIos]}
      >
        <View style={[s.qaIcon, { width: actionIconSize, height: actionIconSize, borderRadius: actionIconSize * 0.3, backgroundColor: t.bg }]}>
          <Ionicons name={icon} size={actionIconSize * 0.42} color={t.fg} />
        </View>
        <Text style={[s.qaLabel, { fontSize: isCompact ? 11 : 12.5 }]} numberOfLines={2}>{label}</Text>
      </Pressable>
    </View>
  );
}

export function Pill({ label, tone = "primary" }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[s.pill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[s.pillText, { color: t.strong }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={28} color={C.primary} /></View>
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={[s.muted, s.center]}>{message}</Text>
    </View>
  );
}

// ---- inputs ---------------------------------------------------------------------
export function Field({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={C.muted}
        accessibilityLabel={label}
        {...rest}
        style={[s.input, rest.multiline && s.inputMulti, error ? s.inputError : null, style]}
      />
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: C.lavender }}
      style={[s.chip, selected && s.chipOn]}
    >
      <Text style={[s.chipText, selected && s.chipTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Button({ title, onPress, variant = "primary", icon, disabled, loading }: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const fg = variant === "primary" ? C.white : variant === "danger" ? TONES.red.strong : C.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      android_ripple={{ color: variant === "primary" ? C.primaryDark : C.lavender }}
      style={[s.btn, variant === "primary" ? s.btnPrimary : variant === "danger" ? s.btnDanger : s.btnSecondary, inactive && s.btnOff]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

// ---- styles ---------------------------------------------------------------------
const s = StyleSheet.create({
  page: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center", gap: 16 },
  center: { textAlign: "center" },
  pressedIos: { opacity: 0.85 },

  h1: { fontSize: 24, fontWeight: "800", color: C.text },
  h2: { fontSize: 18, fontWeight: "700", color: C.text },
  muted: { fontSize: 14, color: C.muted },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  titleText: { flex: 1, minWidth: 0, gap: 2 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 },
  sectionAction: { paddingVertical: 6 },
  sectionActionText: { fontSize: 15, fontWeight: "700", color: C.primary },

  // Opaque colors + hairline border, no elevation => no Android shadow artifacts.
  stat: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, gap: 4, overflow: "hidden" },
  statLabel: { fontSize: 14, color: C.muted },
  statValue: { fontWeight: "800" },

  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, borderWidth: 1, minHeight: 72, overflow: "hidden" },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 12.5, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  cardMeta: { fontSize: 13.5, color: C.muted },

  qaCell: { width: "25%", alignItems: "center" },
  qaPress: { alignItems: "center", gap: 8, paddingVertical: 4, paddingHorizontal: 2, width: "100%" },
  qaIcon: { alignItems: "center", justifyContent: "center" },
  qaLabel: { fontWeight: "600", color: C.text, textAlign: "center" },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 12.5, fontWeight: "700" },

  empty: { alignItems: "center", gap: 8, padding: 24, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.lavenderSoft, alignItems: "center", justifyContent: "center" },

  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: C.text },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, fontSize: 16, color: C.text },
  inputMulti: { minHeight: 96, textAlignVertical: "top" },
  inputError: { borderColor: C.red },
  fieldError: { fontSize: 13, color: TONES.red.strong },

  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 14, fontWeight: "600", color: C.text },
  chipTextOn: { color: C.white },

  btn: { minHeight: 50, borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden" },
  btnPrimary: { backgroundColor: C.primary },
  btnSecondary: { backgroundColor: C.white, borderWidth: 1, borderColor: C.primary },
  btnDanger: { backgroundColor: TONES.red.bg, borderWidth: 1, borderColor: TONES.red.border },
  btnOff: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "700" },
});
