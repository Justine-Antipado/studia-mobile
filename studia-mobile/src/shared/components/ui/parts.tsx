// components/ui/parts.tsx  (shared building blocks)
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { initials } from "@/core/data/storage/session-store";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export const shadow = {
  shadowColor: C.primaryDark,
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

/** Shared text styles */
export const t = StyleSheet.create({
  h1: { fontSize: 20, lineHeight: 28, color: C.text, fontFamily: "Poppins_700Bold" },
  h2: { fontSize: 16, lineHeight: 24, color: C.text, fontFamily: "Poppins_700Bold" },
  muted: { fontSize: 12.5, lineHeight: 18, color: C.muted, fontFamily: "Poppins_400Regular" },
});

/* ---------- Avatar / IconBox ---------- */

export function Avatar({ name, size = 44, max = 2 }: { name: string; size?: number; max?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.lavender,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.primaryDark, fontFamily: "Poppins_700Bold", fontSize: size * 0.34 }}>
        {initials(name, max)}
      </Text>
    </View>
  );
}

export function IconBox({
  name,
  size = 46,
  bg = C.lavenderSoft,
  color = C.primary,
}: {
  name: IconName;
  size?: number;
  bg?: string;
  color?: string;
}) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: 14, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={name} size={size * 0.46} color={color} />
    </View>
  );
}

/* ---------- Cards ---------- */

type ListCardProps = {
  icon: IconName;
  title: string;
  eyebrow?: string;
  meta?: string;
  right?: ReactNode;
  footer?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ListCard({ icon, title, eyebrow, meta, right, footer, iconBg, iconColor, onPress, style }: ListCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={title}
      style={({ pressed }) => [lc.card, pressed && { transform: [{ scale: 0.985 }] }, style]}
    >
      <View style={lc.row}>
        <IconBox name={icon} bg={iconBg} color={iconColor} />
        <View style={lc.text}>
          {eyebrow ? <Text style={lc.eyebrow}>{eyebrow}</Text> : null}
          <Text style={lc.title}>{title}</Text>
          {meta ? <Text style={t.muted}>{meta}</Text> : null}
        </View>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.muted} /> : null)}
      </View>
      {footer ? <View style={lc.footer}>{footer}</View> : null}
    </Pressable>
  );
}

const lc = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 18, padding: 14, ...shadow },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 1 },
  eyebrow: { color: C.primary, fontSize: 11.5, fontFamily: "Poppins_600SemiBold" },
  title: { color: C.text, fontSize: 14.5, lineHeight: 20, fontFamily: "Poppins_700Bold" },
  footer: { marginTop: 12 },
});

export function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "orange" }) {
  const orange = tone === "orange";
  return (
    <View style={[st.card, orange && { backgroundColor: `${C.orange}1F` }]}>
      <Text style={[t.muted, orange && { color: C.orange }]}>{label}</Text>
      <Text style={[st.value, orange && { color: C.orange }]}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, ...shadow },
  value: { color: C.text, fontSize: 26, lineHeight: 34, fontFamily: "Poppins_700Bold" },
});

export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [qa.wrap, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <IconBox name={icon} size={56} />
      <Text style={qa.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const qa = StyleSheet.create({
  wrap: { width: 68, alignItems: "center", gap: 6 },
  label: { color: C.muted, fontSize: 11.5, lineHeight: 15, textAlign: "center", fontFamily: "Poppins_400Regular" },
});

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={sh.row}>
      <Text style={t.h2}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={sh.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  action: { color: C.primary, fontSize: 13, fontFamily: "Poppins_600SemiBold" },
});

/* ---------- Small elements ---------- */

const TONES = {
  orange: { bg: `${C.orange}26`, fg: "#C05621" },
  blue: { bg: `${C.blue}22`, fg: "#2B5FC7" },
  green: { bg: C.greenTint, fg: "#2F855A" },
  red: { bg: `${C.red}1F`, fg: C.red },
  purple: { bg: C.lavenderSoft, fg: C.primaryDark },
} as const;

export function Pill({ text, tone = "purple" }: { text: string; tone?: keyof typeof TONES }) {
  return (
    <View style={{ backgroundColor: TONES[tone].bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: TONES[tone].fg, fontSize: 11, fontFamily: "Poppins_600SemiBold" }}>{text}</Text>
    </View>
  );
}

export function AiTag({ text }: { text: string }) {
  return (
    <View style={at.tag}>
      <Ionicons name="sparkles-outline" size={11} color={C.primary} />
      <Text style={at.text}>{text}</Text>
    </View>
  );
}

const at = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: C.lavenderSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { color: C.primary, fontSize: 10.5, fontFamily: "Poppins_600SemiBold" },
});

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: C.lavenderSoft, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(pct * 100)}%`, height: 6, borderRadius: 3, backgroundColor: C.primary }} />
    </View>
  );
}

export function TabChips({ items, value, onChange }: { items: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={tc.scroll}
      contentContainerStyle={tc.content}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((it) => {
        const on = it === value;
        return (
          <Pressable
            key={it}
            onPress={() => onChange(it)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[tc.chip, on && tc.chipOn]}
          >
            <Text style={[tc.text, on && tc.textOn]}>{it}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const tc = StyleSheet.create({
  scroll: { flexGrow: 0, marginHorizontal: -18 },
  content: { paddingHorizontal: 18, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: C.lavenderSoft },
  chipOn: { backgroundColor: C.primary },
  text: { color: C.primaryDark, fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  textOn: { color: C.white },
});

export function ActionButton({
  label,
  icon,
  variant = "primary",
  onPress,
  disabled,
  style,
}: {
  label: string;
  icon?: IconName;
  variant?: "primary" | "secondary";
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      // No opacity here: Android draws a rectangular shadow when opacity + elevation are combined.
      style={({ pressed }) => [
        ab.base,
        primary ? ab.primary : ab.secondary,
        pressed && !disabled && { backgroundColor: primary ? C.primaryDark : C.lavender },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={primary ? C.white : C.primaryDark} /> : null}
      <Text style={[ab.label, { color: primary ? C.white : C.primaryDark }]}>{label}</Text>
    </Pressable>
  );
}

const ab = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 15,
  },
  primary: {
    backgroundColor: C.primary,
    shadowColor: C.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondary: { backgroundColor: C.lavenderSoft, borderColor: C.lavender },
  label: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
});

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={sf.box}>
      <Ionicons name="search-outline" size={18} color={C.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={sf.input}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const sf = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, color: C.text, fontSize: 14, fontFamily: "Poppins_400Regular", paddingVertical: 0 },
});

export function BackTitle({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={bt.row}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={bt.back}>
        <Ionicons name="chevron-back" size={20} color={C.primaryDark} />
      </Pressable>
      <Text style={[t.h1, bt.title]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const bt = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.lavenderSoft, alignItems: "center", justifyContent: "center" },
  title: { flex: 1 },
});

export function EmptyState({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  return (
    <View style={es.box}>
      <IconBox name={icon} size={56} />
      <Text style={es.title}>{title}</Text>
      <Text style={[t.muted, { textAlign: "center" }]}>{sub}</Text>
    </View>
  );
}

const es = StyleSheet.create({
  box: { alignItems: "center", gap: 8, paddingVertical: 36, paddingHorizontal: 24 },
  title: { color: C.text, fontSize: 15, fontFamily: "Poppins_700Bold" },
});