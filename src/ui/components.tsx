import { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors, styles } from "./theme";

export interface ChipOption {
  id: string;
  label: string;
}

/** Horizontal single-select chip row used for every picker in the app. */
export const ChipPicker = ({
  options,
  selectedId,
  onSelect
}: {
  options: ChipOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
    {options.map((option) => {
      const active = option.id === selectedId;
      return (
        <Pressable
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={[styles.chip, active && styles.chipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
        >
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

export const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <View style={{ gap: 8 }}>
    <Text style={styles.sectionLabel}>{label}</Text>
    {children}
  </View>
);

export type BannerTone = "info" | "positive" | "warning" | "danger";

const bannerTones: Record<BannerTone, { background: string; text: string }> = {
  info: { background: colors.accentSoft, text: colors.accent },
  positive: { background: colors.positiveSoft, text: colors.positive },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger }
};

/** Inline status message: match confidence, permission gaps, engine caveats. */
export const Banner = ({
  tone = "info",
  title,
  body
}: {
  tone?: BannerTone;
  title?: string;
  body: string;
}) => {
  const palette = bannerTones[tone];
  return (
    <View
      style={{
        backgroundColor: palette.background,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 2
      }}
    >
      {title ? (
        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 12 }}>{title}</Text>
      ) : null}
      <Text style={{ color: palette.text, fontSize: 13, lineHeight: 18 }}>{body}</Text>
    </View>
  );
};

export const Button = ({
  label,
  onPress,
  variant = "primary",
  disabled = false
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    style={[
      variant === "primary" ? styles.primaryButton : styles.secondaryButton,
      disabled && { opacity: 0.45 }
    ]}
  >
    <Text style={variant === "primary" ? styles.primaryButtonText : styles.secondaryButtonText}>
      {label}
    </Text>
  </Pressable>
);

export const Toggle = ({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="switch"
    accessibilityState={{ checked: active }}
    style={[styles.chip, active && styles.chipActive, { marginRight: 0 }]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);
