import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

import { seedCards } from "./src/data/cards";
import { seedMerchants, seedSettings } from "./src/data/merchants";
import { adHocMerchant, learnAlias, matchMerchant } from "./src/engine/merchantMatch";
import { formatMoney, formatRate, recommend } from "./src/engine/rewards";
import { pruneLedger, recordSpend } from "./src/engine/spend";
import {
  captureCurrentLocation,
  handleRegionEnter,
  PermissionReport,
  requestNudgePermissions,
  SyncResult,
  syncGeofences
} from "./src/services/geofence";
import { evaluateNudge } from "./src/services/nudgePolicy";
import { clearAll, loadSnapshot, saveJson, storageKeys } from "./src/services/storage";
import { Banner, Button, ChipPicker, Section, Toggle } from "./src/ui/components";
import { colors, styles } from "./src/ui/theme";
import {
  AppSettings,
  Card,
  CardScore,
  LoggedDecision,
  MatchConfidence,
  Merchant,
  MerchantCategory,
  merchantCategories,
  categoryLabels,
  NudgeState,
  PaymentMethod,
  PurchaseChannel,
  SpendLedger,
  UserOverride
} from "./src/types/domain";

type Tab = "recommend" | "places" | "cards" | "history";

const tabs: { key: Tab; label: string }[] = [
  { key: "recommend", label: "What card?" },
  { key: "places", label: "Places" },
  { key: "cards", label: "Wallet" },
  { key: "history", label: "History" }
];

const confidenceTone: Record<MatchConfidence, "positive" | "warning" | "danger"> = {
  high: "positive",
  medium: "warning",
  ambiguous: "warning",
  low: "danger"
};

const isAdHocId = (merchantId: string): boolean => merchantId.startsWith("adhoc:");

const parseAmount = (raw: string): number | undefined => {
  const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

export default function App() {
  const [tab, setTab] = useState<Tab>("recommend");
  const [hydrated, setHydrated] = useState(false);

  const [cards, setCards] = useState<Card[]>(seedCards);
  const [merchants, setMerchants] = useState<Merchant[]>(seedMerchants);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [decisions, setDecisions] = useState<LoggedDecision[]>([]);
  const [settings, setSettings] = useState<AppSettings>(seedSettings);
  const [ledger, setLedger] = useState<SpendLedger>({});
  const [learnedAliases, setLearnedAliases] = useState<Record<string, string>>({});
  const [nudgeState, setNudgeState] = useState<NudgeState>({
    lastNudgeAt: 0,
    lastNudgeByMerchant: {}
  });

  // Recommendation inputs.
  const [query, setQuery] = useState("");
  const [confirmedMerchantId, setConfirmedMerchantId] = useState<string | null>(null);
  const [adHocCategory, setAdHocCategory] = useState<MerchantCategory>("other");
  const [channel, setChannel] = useState<PurchaseChannel>("in_store");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("apple_pay");
  const [amountText, setAmountText] = useState("");
  const [isForeign, setIsForeign] = useState(false);
  const [viaPortal, setViaPortal] = useState(false);
  const [showAllCards, setShowAllCards] = useState(false);

  // Geofence surface.
  const [permissions, setPermissions] = useState<PermissionReport | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Custom card editor.
  const [newCardName, setNewCardName] = useState("");
  const [newCardNetwork, setNewCardNetwork] = useState<Card["network"]>("Visa");
  const [newCardRate, setNewCardRate] = useState("1.5");

  const hydratedRef = useRef(false);

  useEffect(() => {
    const hydrate = async (): Promise<void> => {
      const snapshot = await loadSnapshot();
      setCards(snapshot.cards);
      setMerchants(snapshot.merchants);
      setFavorites(snapshot.favorites);
      setOverrides(snapshot.overrides);
      setDecisions(snapshot.decisions);
      setSettings(snapshot.settings);
      setLedger(pruneLedger(snapshot.ledger));
      setLearnedAliases(snapshot.learnedAliases);
      setNudgeState(snapshot.nudgeState);
      hydratedRef.current = true;
      setHydrated(true);
    };

    void hydrate();
  }, []);

  // Persist only after hydration, otherwise the first render would overwrite
  // stored data with seeds.
  const persist = useCallback(<T,>(key: string, value: T): void => {
    if (!hydratedRef.current) {
      return;
    }
    void saveJson(key, value);
  }, []);

  useEffect(() => persist(storageKeys.cards, cards), [cards, persist]);
  useEffect(() => persist(storageKeys.merchants, merchants), [merchants, persist]);
  useEffect(() => persist(storageKeys.favorites, favorites), [favorites, persist]);
  useEffect(() => persist(storageKeys.overrides, overrides), [overrides, persist]);
  useEffect(() => persist(storageKeys.decisions, decisions), [decisions, persist]);
  useEffect(() => persist(storageKeys.settings, settings), [settings, persist]);
  useEffect(() => persist(storageKeys.ledger, ledger), [ledger, persist]);
  useEffect(() => persist(storageKeys.learnedAliases, learnedAliases), [learnedAliases, persist]);

  // Tapping a geofence notification should land on that store's answer.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { merchantId?: string }
        | undefined;
      if (data?.merchantId) {
        setConfirmedMerchantId(data.merchantId);
        setQuery("");
        setChannel("in_store");
        setTab("recommend");
      }
    });
    return () => subscription.remove();
  }, []);

  const match = useMemo(
    () => matchMerchant(query, merchants, { learnedAliases }),
    [query, merchants, learnedAliases]
  );

  const favoriteMerchants = useMemo(
    () => merchants.filter((merchant) => favorites.includes(merchant.id)),
    [merchants, favorites]
  );

  const activeMerchant: Merchant = useMemo(() => {
    const confirmed = confirmedMerchantId
      ? merchants.find((item) => item.id === confirmedMerchantId)
      : undefined;
    if (confirmed) {
      return confirmed;
    }
    if (query.trim() && match.best) {
      return match.best.merchant;
    }
    if (query.trim()) {
      return adHocMerchant(query, adHocCategory);
    }
    return favoriteMerchants[0] ?? merchants[0] ?? seedMerchants[0]!;
  }, [confirmedMerchantId, merchants, query, match, adHocCategory, favoriteMerchants]);

  const isAdHoc = isAdHocId(activeMerchant.id);
  const amount = parseAmount(amountText);

  const result = useMemo(
    () =>
      recommend(
        cards,
        {
          merchant: activeMerchant,
          channel,
          paymentMethod,
          ...(amount != null ? { amount } : {}),
          isForeignTransaction: isForeign,
          viaIssuerPortal: viaPortal
        },
        { overrides, ledger }
      ),
    [cards, activeMerchant, channel, paymentMethod, amount, isForeign, viaPortal, overrides, ledger]
  );

  const nudgePreview = useMemo(
    () =>
      evaluateNudge(
        settings,
        {
          merchantId: activeMerchant.id,
          delta: result.deltaVsRunnerUp,
          hasWinner: result.winner != null,
          isTie: result.isTie
        },
        nudgeState
      ),
    [settings, activeMerchant.id, result, nudgeState]
  );

  const selectMerchant = (merchantId: string): void => {
    setConfirmedMerchantId(merchantId);
    // Remember the spelling that got us here so the same descriptor is a
    // one-tap match next time.
    if (query.trim() && !isAdHocId(merchantId)) {
      setLearnedAliases((prev) => learnAlias(prev, query, merchantId));
    }
  };

  const logDecision = (accepted: boolean, score: CardScore | null): void => {
    if (!score) {
      return;
    }

    const entry: LoggedDecision = {
      id: `${Date.now()}-${score.cardId}`,
      merchantId: activeMerchant.id,
      cardId: score.cardId,
      effectiveRate: score.effectiveRate,
      ...(amount != null ? { amount } : {}),
      summary: result.summary,
      timestamp: Date.now(),
      accepted,
      source: "manual"
    };
    setDecisions((prev) => [entry, ...prev].slice(0, 300));

    // Only accepted purchases count against a capped bonus category.
    if (accepted && amount != null && score.appliedRuleId) {
      const card = cards.find((item) => item.id === score.cardId);
      const rule = card?.rewardRules.find((item) => item.id === score.appliedRuleId);
      if (rule?.caps) {
        setLedger((prev) => recordSpend(prev, rule.id, rule.caps!, amount));
      }
    }

    setAmountText("");
  };

  const toggleFavorite = (merchantId: string): void => {
    setFavorites((prev) =>
      prev.includes(merchantId) ? prev.filter((id) => id !== merchantId) : [...prev, merchantId]
    );
  };

  const pinLocation = async (merchantId: string): Promise<void> => {
    const captured = await captureCurrentLocation();
    if (!captured.ok) {
      Alert.alert("Could not pin this store", captured.reason);
      return;
    }

    setMerchants((prev) =>
      prev.map((merchant) =>
        merchant.id === merchantId ? { ...merchant, location: captured.point } : merchant
      )
    );
    Alert.alert(
      "Store pinned",
      "Saved this spot. Turn geofence nudges on to start monitoring it."
    );
  };

  const refreshGeofences = useCallback(
    async (enabled: boolean, list: Merchant[]): Promise<void> => {
      const sync = await syncGeofences(list, enabled);
      setSyncResult(sync);
      if (sync.error) {
        Alert.alert("Geofencing failed to start", sync.error);
      }
    },
    []
  );

  const setGeofenceEnabled = async (enabled: boolean): Promise<void> => {
    if (!enabled) {
      setSettings((prev) => ({ ...prev, geofenceEnabled: false }));
      await refreshGeofences(false, []);
      return;
    }

    const report = await requestNudgePermissions();
    setPermissions(report);
    if (!report.granted) {
      Alert.alert(
        "Still missing something",
        `Geofence nudges need: ${report.missing.join(", ")}. You can grant these in Settings and try again.`
      );
      setSettings((prev) => ({ ...prev, geofenceEnabled: false }));
      return;
    }

    // The effect below picks this up and registers the regions, so there is no
    // second syncGeofences call racing this one.
    setSettings((prev) => ({ ...prev, geofenceEnabled: true }));
  };

  // Keep the monitored regions in step with the favorites list.
  useEffect(() => {
    if (!hydrated || !settings.geofenceEnabled) {
      return;
    }
    void refreshGeofences(true, favoriteMerchants);
  }, [hydrated, settings.geofenceEnabled, favoriteMerchants, refreshGeofences]);

  const testNudge = async (merchantId: string): Promise<void> => {
    const outcome = await handleRegionEnter(merchantId);
    Alert.alert(
      outcome.notified ? "Nudge sent" : "No nudge",
      outcome.notified ? outcome.body ?? outcome.reason : outcome.reason
    );
    if (outcome.notified) {
      const snapshot = await loadSnapshot();
      setNudgeState(snapshot.nudgeState);
    }
  };

  const addCustomCard = (): void => {
    const rate = Number.parseFloat(newCardRate);
    if (!newCardName.trim() || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      Alert.alert("Check the details", "A card needs a name and a base rate between 0 and 100%.");
      return;
    }

    const id = `custom-${Date.now()}`;
    setCards((prev) => [
      ...prev,
      {
        id,
        name: newCardName.trim(),
        shortName: newCardName.trim().slice(0, 18),
        network: newCardNetwork,
        rewardCurrency: "cash",
        rewardUnitValue: 1,
        annualFee: 0,
        foreignTransactionFee: 0,
        isCustom: true,
        rewardRules: [
          { id: `${id}-base`, label: `${rate}% on everything`, rate: rate / 100 }
        ]
      }
    ]);
    setNewCardName("");
    setNewCardRate("1.5");
  };

  const removeCard = (cardId: string): void => {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
    setOverrides((prev) => prev.filter((item) => item.cardId !== cardId));
  };

  const setPointValue = (cardId: string, value: number): void => {
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, rewardUnitValue: value } : card))
    );
  };

  const resetEverything = (): void => {
    Alert.alert("Reset all data?", "This clears your cards, pins, overrides and history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await clearAll();
            setCards(seedCards);
            setMerchants(seedMerchants);
            setFavorites([]);
            setOverrides([]);
            setDecisions([]);
            setSettings(seedSettings);
            setLedger({});
            setLearnedAliases({});
            setSyncResult(null);
          })();
        }
      }
    ]);
  };

  const paymentOptions =
    channel === "online"
      ? [
          { id: "apple_pay", label: "Apple Pay" },
          { id: "online_checkout", label: "Card number" }
        ]
      : [
          { id: "apple_pay", label: "Apple Pay" },
          { id: "physical_card", label: "Tap / swipe" }
        ];

  const override = overrides.find((item) => item.merchantId === activeMerchant.id);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Credit Card Teller</Text>
        <Text style={styles.subtitle}>
          {hydrated ? "Best card, and why." : "Loading your wallet…"}
        </Text>
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
            onPress={() => setTab(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
          >
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "recommend" && (
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Section label="Where are you?">
            <TextInput
              style={styles.input}
              placeholder="Store name, card descriptor or checkout URL"
              autoCapitalize="none"
              autoCorrect={false}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setConfirmedMerchantId(null);
              }}
            />

            {query.trim().length > 0 && match.best && match.needsConfirmation && !confirmedMerchantId ? (
              <Banner
                tone={confidenceTone[match.confidence]}
                title={`${match.confidence.toUpperCase()} confidence match`}
                body={match.explanation}
              />
            ) : null}

            {query.trim().length > 0 && !match.best ? (
              <Banner tone="danger" title="No match" body={match.explanation} />
            ) : null}

            {query.trim().length > 0 && match.candidates.length > 0 ? (
              <ChipPicker
                options={match.candidates.map((candidate) => ({
                  id: candidate.merchant.id,
                  label: `${candidate.merchant.name} · ${Math.round(candidate.score * 100)}%`
                }))}
                selectedId={activeMerchant.id}
                onSelect={selectMerchant}
              />
            ) : null}

            {query.trim().length > 0 && !match.best ? (
              <>
                <Text style={styles.faintText}>
                  Pick the category and the engine will still rank your cards for
                  &ldquo;{query.trim()}&rdquo;.
                </Text>
                <ChipPicker
                  options={merchantCategories.map((category) => ({
                    id: category,
                    label: categoryLabels[category]
                  }))}
                  selectedId={adHocCategory}
                  onSelect={(id) => setAdHocCategory(id as MerchantCategory)}
                />
              </>
            ) : null}

            {query.trim().length === 0 ? (
              <ChipPicker
                options={(favoriteMerchants.length > 0 ? favoriteMerchants : merchants)
                  .slice(0, 12)
                  .map((merchant) => ({ id: merchant.id, label: merchant.name }))}
                selectedId={activeMerchant.id}
                onSelect={setConfirmedMerchantId}
              />
            ) : null}
          </Section>

          <Section label="How are you paying?">
            <ChipPicker
              options={[
                { id: "in_store", label: "In store" },
                { id: "online", label: "Online" }
              ]}
              selectedId={channel}
              onSelect={(id) => {
                const next = id as PurchaseChannel;
                setChannel(next);
                setPaymentMethod((prev) => {
                  if (next === "online" && prev === "physical_card") return "online_checkout";
                  if (next === "in_store" && prev === "online_checkout") return "physical_card";
                  return prev;
                });
              }}
            />
            <ChipPicker
              options={paymentOptions}
              selectedId={paymentMethod}
              onSelect={(id) => setPaymentMethod(id as PaymentMethod)}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.grow]}
                placeholder="Amount (optional)"
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
              />
            </View>
            <View style={[styles.row, { flexWrap: "wrap" }]}>
              <Toggle
                label="Foreign purchase"
                active={isForeign}
                onPress={() => setIsForeign((prev) => !prev)}
              />
              <Toggle
                label="Booked via issuer portal"
                active={viaPortal}
                onPress={() => setViaPortal((prev) => !prev)}
              />
            </View>
          </Section>

          <View style={styles.panel}>
            <Text style={styles.eyebrow}>Use this card at {activeMerchant.name}</Text>
            {result.winner ? (
              <>
                <Text style={styles.bestCardName}>{result.winner.cardName}</Text>
                <Text style={styles.bestRate}>{formatRate(result.winner.effectiveRate)}</Text>
                <Text style={styles.smallText}>{result.summary}</Text>

                <View style={styles.divider} />
                <Text style={styles.eyebrow}>Why</Text>
                {result.winner.factors.map((factor, index) => (
                  <View key={`${factor.label}-${index}`} style={styles.spread}>
                    <Text style={[styles.smallText, styles.grow]}>
                      <Text style={{ fontWeight: "700", color: colors.ink }}>{factor.label}</Text>
                      {` — ${factor.detail}`}
                    </Text>
                    {factor.deltaRate != null ? (
                      <Text
                        style={{
                          color: factor.deltaRate < 0 ? colors.danger : colors.positive,
                          fontWeight: "700",
                          fontSize: 13
                        }}
                      >
                        {factor.deltaRate > 0 ? "+" : ""}
                        {formatRate(factor.deltaRate)}
                      </Text>
                    ) : null}
                  </View>
                ))}

                {result.adjustments.map((note) => (
                  <Banner key={note} tone="warning" body={note} />
                ))}
                {result.winner.caveats.map((note) => (
                  <Text key={note} style={styles.faintText}>
                    • {note}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={styles.smallText}>{result.summary}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Button label="I used it" onPress={() => logDecision(true, result.winner)} />
            <Button
              label="Used another"
              variant="secondary"
              onPress={() => logDecision(false, result.winner)}
            />
          </View>

          <Pressable onPress={() => setShowAllCards((prev) => !prev)} style={styles.linkButton}>
            <Text style={styles.linkText}>
              {showAllCards ? "Hide" : "Show"} all {result.ranked.length} cards
            </Text>
          </Pressable>

          {showAllCards
            ? result.ranked.map((score) => (
                <View
                  key={score.cardId}
                  style={[
                    styles.listItem,
                    score.cardId === result.winner?.cardId && styles.listItemActive
                  ]}
                >
                  <View style={styles.spread}>
                    <Text style={{ fontWeight: "700", color: colors.ink, flex: 1 }}>
                      {score.cardName}
                    </Text>
                    <Text
                      style={{
                        fontWeight: "800",
                        color: score.eligible ? colors.accent : colors.inkFaint
                      }}
                    >
                      {score.eligible ? formatRate(score.effectiveRate) : "—"}
                    </Text>
                  </View>
                  <Text style={styles.faintText}>
                    {score.eligible ? score.headline : score.ineligibleReason}
                  </Text>
                  {score.eligible && amount != null && score.estimatedValue != null ? (
                    <Text style={styles.faintText}>
                      {formatMoney(score.estimatedValue)} back on {formatMoney(amount)}
                    </Text>
                  ) : null}
                </View>
              ))
            : null}

          {!isAdHoc ? (
            <Section label="Always use a specific card here">
              <ChipPicker
                options={result.ranked
                  .filter((score) => score.eligible)
                  .map((score) => ({ id: score.cardId, label: score.cardShortName }))}
                selectedId={override?.cardId ?? null}
                onSelect={(cardId) =>
                  setOverrides((prev) => [
                    ...prev.filter((item) => item.merchantId !== activeMerchant.id),
                    { merchantId: activeMerchant.id, cardId, createdAt: Date.now() }
                  ])
                }
              />
              {override ? (
                <Pressable
                  style={styles.linkButton}
                  onPress={() =>
                    setOverrides((prev) =>
                      prev.filter((item) => item.merchantId !== activeMerchant.id)
                    )
                  }
                >
                  <Text style={styles.linkText}>Clear override</Text>
                </Pressable>
              ) : null}
            </Section>
          ) : null}

          <Section label="Would this interrupt you?">
            <Banner
              tone={nudgePreview.allow ? "positive" : "info"}
              title={nudgePreview.allow ? "A nudge would fire here" : "No nudge"}
              body={nudgePreview.explanation}
            />
          </Section>
        </ScrollView>
      )}

      {tab === "places" && (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.panel}>
            <View style={styles.spread}>
              <View style={styles.grow}>
                <Text style={styles.sectionLabel}>Geofence nudges</Text>
                <Text style={styles.smallText}>
                  Off by default. Only pinned favorites are monitored, and iOS allows 20 at a time.
                </Text>
              </View>
              <Switch
                value={settings.geofenceEnabled}
                onValueChange={(value) => void setGeofenceEnabled(value)}
              />
            </View>

            {permissions && permissions.missing.length > 0 ? (
              <Banner
                tone="warning"
                title="Missing permissions"
                body={permissions.missing.join(" · ")}
              />
            ) : null}

            {settings.geofenceEnabled && syncResult ? (
              <Banner
                tone={syncResult.started ? "positive" : "warning"}
                title={
                  syncResult.started
                    ? `Monitoring ${syncResult.registered.length} store(s)`
                    : "Nothing is being monitored"
                }
                body={
                  syncResult.skipped.length > 0
                    ? syncResult.skipped.map((item) => `${item.name}: ${item.reason}`).join("\n")
                    : "All favorites are pinned and registered."
                }
              />
            ) : null}
          </View>

          <Section label="Nudge quality gate">
            <Text style={styles.faintText}>Only interrupt when the best card wins by at least</Text>
            <ChipPicker
              options={[
                { id: "0.005", label: "0.5 pts" },
                { id: "0.01", label: "1 pt" },
                { id: "0.02", label: "2 pts" },
                { id: "0.03", label: "3 pts" }
              ]}
              selectedId={String(settings.nudgeDeltaThreshold)}
              onSelect={(id) =>
                setSettings((prev) => ({ ...prev, nudgeDeltaThreshold: Number(id) }))
              }
            />
            <Text style={styles.faintText}>Quiet hours start</Text>
            <ChipPicker
              options={[20, 21, 22, 23].map((hour) => ({ id: String(hour), label: `${hour}:00` }))}
              selectedId={String(settings.quietHoursStart)}
              onSelect={(id) => setSettings((prev) => ({ ...prev, quietHoursStart: Number(id) }))}
            />
            <Text style={styles.faintText}>Quiet hours end</Text>
            <ChipPicker
              options={[5, 6, 7, 8, 9].map((hour) => ({ id: String(hour), label: `${hour}:00` }))}
              selectedId={String(settings.quietHoursEnd)}
              onSelect={(id) => setSettings((prev) => ({ ...prev, quietHoursEnd: Number(id) }))}
            />
            <Text style={styles.faintText}>Assume this payment method when a geofence fires</Text>
            <ChipPicker
              options={[
                { id: "apple_pay", label: "Apple Pay" },
                { id: "physical_card", label: "Tap / swipe" }
              ]}
              selectedId={settings.defaultPaymentMethod}
              onSelect={(id) =>
                setSettings((prev) => ({ ...prev, defaultPaymentMethod: id as PaymentMethod }))
              }
            />
          </Section>

          <Section label="Your stores">
            {merchants.map((merchant) => {
              const isFavorite = favorites.includes(merchant.id);
              return (
                <View
                  key={merchant.id}
                  style={[styles.listItem, isFavorite && styles.listItemActive]}
                >
                  <View style={styles.spread}>
                    <View style={styles.grow}>
                      <Text style={{ fontWeight: "700", color: colors.ink }}>{merchant.name}</Text>
                      <Text style={styles.faintText}>
                        {categoryLabels[merchant.category]}
                        {merchant.location
                          ? ` · pinned (${merchant.radiusMeters ?? 100}m)`
                          : " · not pinned"}
                      </Text>
                    </View>
                    <Switch value={isFavorite} onValueChange={() => toggleFavorite(merchant.id)} />
                  </View>

                  {isFavorite ? (
                    <View style={styles.row}>
                      <Button
                        label={merchant.location ? "Re-pin here" : "Pin current location"}
                        variant="secondary"
                        onPress={() => void pinLocation(merchant.id)}
                      />
                      <Button
                        label="Test nudge"
                        variant="secondary"
                        onPress={() => void testNudge(merchant.id)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Section>
        </ScrollView>
      )}

      {tab === "cards" && (
        <ScrollView contentContainerStyle={styles.page}>
          <Section label={`Your wallet (${cards.length})`}>
            {cards.map((card) => (
              <View key={card.id} style={styles.listItem}>
                <View style={styles.spread}>
                  <Text style={{ fontWeight: "700", color: colors.ink, flex: 1 }}>{card.name}</Text>
                  <Text style={styles.faintText}>{card.network}</Text>
                </View>
                <Text style={styles.faintText}>
                  {card.annualFee > 0 ? `${formatMoney(card.annualFee)}/yr` : "No annual fee"} ·{" "}
                  {card.foreignTransactionFee > 0
                    ? `${formatRate(card.foreignTransactionFee)} foreign fee`
                    : "No foreign fee"}
                  {card.termsAsOf ? ` · terms checked ${card.termsAsOf}` : ""}
                </Text>

                {card.rewardRules.map((rule) => (
                  <Text key={rule.id} style={styles.smallText}>
                    • {rule.label}
                    {rule.caps
                      ? ` (first ${formatMoney(rule.caps.amount)}/${rule.caps.period})`
                      : ""}
                  </Text>
                ))}

                {card.rewardCurrency !== "cash" ? (
                  <>
                    <Text style={styles.faintText}>
                      Point value used when ranking (cents per point)
                    </Text>
                    <ChipPicker
                      options={[
                        { id: "1", label: "1.0¢ (cash)" },
                        { id: "1.25", label: "1.25¢" },
                        { id: "1.5", label: "1.5¢" },
                        { id: "2", label: "2.0¢" }
                      ]}
                      selectedId={String(card.rewardUnitValue)}
                      onSelect={(id) => setPointValue(card.id, Number(id))}
                    />
                  </>
                ) : null}

                {card.sourceNote ? <Text style={styles.faintText}>{card.sourceNote}</Text> : null}

                {card.isCustom ? (
                  <Pressable style={styles.linkButton} onPress={() => removeCard(card.id)}>
                    <Text style={[styles.linkText, { color: colors.danger }]}>Remove card</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Section>

          <Section label="Add a card">
            <TextInput
              style={styles.input}
              placeholder="Card name"
              value={newCardName}
              onChangeText={setNewCardName}
            />
            <ChipPicker
              options={["Visa", "Mastercard", "American Express", "Discover"].map((network) => ({
                id: network,
                label: network
              }))}
              selectedId={newCardNetwork}
              onSelect={(id) => setNewCardNetwork(id as Card["network"])}
            />
            <TextInput
              style={styles.input}
              placeholder="Base reward %"
              keyboardType="decimal-pad"
              value={newCardRate}
              onChangeText={setNewCardRate}
            />
            <Text style={styles.faintText}>
              Custom cards start with a flat base rate. Bonus categories and caps are edited in
              src/data/cards.ts for now.
            </Text>
            <Button label="Add to wallet" onPress={addCustomCard} />
          </Section>

          <Section label="Data">
            <Banner
              tone="warning"
              title="Verify before you trust"
              body="Reward terms change. Every seeded card records the month its rates were checked; confirm against your issuer before relying on a recommendation."
            />
            <Button label="Reset all local data" variant="secondary" onPress={resetEverything} />
          </Section>
        </ScrollView>
      )}

      {tab === "history" && (
        <View style={[styles.page, { flex: 1 }]}>
          <Text style={styles.sectionLabel}>Decision log</Text>
          <Text style={styles.faintText}>
            {decisions.length} entries · {decisions.filter((item) => item.accepted).length} followed
          </Text>
          <FlatList
            data={decisions}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const merchant = merchants.find((entry) => entry.id === item.merchantId);
              const card = cards.find((entry) => entry.id === item.cardId);
              return (
                <View style={styles.listItem}>
                  <View style={styles.spread}>
                    <Text style={{ fontWeight: "700", color: colors.ink, flex: 1 }}>
                      {merchant?.name ?? item.merchantId.replace("adhoc:", "")}
                    </Text>
                    <Text style={styles.faintText}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.smallText}>
                    {card?.name ?? item.cardId} · {formatRate(item.effectiveRate)}
                    {item.amount != null ? ` · ${formatMoney(item.amount)}` : ""}
                  </Text>
                  <Text
                    style={[
                      styles.faintText,
                      { color: item.accepted ? colors.positive : colors.inkFaint }
                    ]}
                  >
                    {item.accepted ? "Followed the suggestion" : "Used a different card"}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.smallText}>
                Nothing logged yet. Tap &ldquo;I used it&rdquo; after a purchase to build a record.
              </Text>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}
