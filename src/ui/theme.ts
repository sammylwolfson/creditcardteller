import { StyleSheet } from "react-native";

export const colors = {
  background: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  ink: "#0f172a",
  inkMuted: "#475569",
  inkFaint: "#64748b",
  accent: "#0284c7",
  accentSoft: "#e0f2fe",
  positive: "#047857",
  positiveSoft: "#ecfdf5",
  warning: "#b45309",
  warningSoft: "#fffbeb",
  danger: "#b91c1c",
  dangerSoft: "#fef2f2"
};

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: colors.border
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },

  tabs: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 8, gap: 6 },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: colors.surface
  },
  tabButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.ink, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: colors.background },

  page: { padding: 16, gap: 14, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.ink },
  smallText: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  faintText: { color: colors.inkFaint, fontSize: 12, lineHeight: 17 },

  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8
  },

  chipRow: { flexGrow: 0 },
  chip: {
    marginRight: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 7
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontWeight: "500", fontSize: 13 },
  chipTextActive: { color: colors.background, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink
  },

  row: { flexDirection: "row", gap: 10 },
  spread: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  grow: { flex: 1 },

  primaryButton: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    flex: 1
  },
  primaryButtonText: { color: colors.background, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    flex: 1
  },
  secondaryButtonText: { color: colors.ink, fontWeight: "700" },
  linkButton: { alignSelf: "flex-start", paddingVertical: 4 },
  linkText: { color: colors.accent, fontWeight: "600", fontSize: 13 },

  bestRate: { fontSize: 34, fontWeight: "800", color: colors.accent },
  bestCardName: { fontSize: 18, fontWeight: "700", color: colors.ink },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.inkFaint
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  listItem: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 4
  },
  listItemActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft }
});
