// list-row.tsx — the standard row for every list (classes, lessons, tasks, people, settings).
// Memoized: it is rendered inside FlatList, so props must stay stable (useCallback the handlers).
import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, IconTile, type IconName } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { MIN_TOUCH, RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

export type ListRowProps = {
  title: string;
  /** Small colored line above the title (course code, date, status). */
  eyebrow?: string;
  subtitle?: string;
  icon?: IconName;
  iconBg?: string;
  iconColor?: string;
  /** Replaces the icon tile (e.g. an Avatar). */
  leading?: ReactNode;
  /** Replaces the chevron (e.g. a Badge or a score). */
  trailing?: ReactNode;
  /** Extra content under the row, inside the same card (progress bar, chips). */
  footer?: ReactNode;
  onPress?: () => void;
  /** flat = no shadow (use inside another card or a sectioned settings list). */
  flat?: boolean;
};

export const ListRow = memo(function ListRow({
  title,
  eyebrow,
  subtitle,
  icon,
  iconBg,
  iconColor,
  leading,
  trailing,
  footer,
  onPress,
  flat = false,
}: ListRowProps) {
  const body = (
    <>
      <View style={s.row}>
        {leading ?? (icon ? <IconTile name={icon} bg={iconBg} color={iconColor} /> : null)}
        <View style={s.text}>
          {eyebrow ? (
            <Text style={TYPE.eyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={TYPE.h3} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={TYPE.muted} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ?? (onPress ? <Icon name="chevron-forward" size="md" color={C.muted} /> : null)}
      </View>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </>
  );

  if (!onPress) return <View style={[s.card, flat && s.flat]}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[eyebrow, title, subtitle].filter(Boolean).join(", ")}
      style={({ pressed }) => [s.card, flat && s.flat, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  );
});

const s = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH,
    backgroundColor: C.white,
    borderRadius: RADIUS.xl,
    padding: SPACE.lg - 2,
    ...SHADOW.card,
  },
  flat: { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  text: { flex: 1, gap: 1 },
  footer: { marginTop: SPACE.md },
  pressed: { transform: [{ scale: 0.985 }] },
});
