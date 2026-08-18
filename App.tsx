import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";

import { seedCards, seedMerchants, seedSettings } from "./src/data/seed";
import { decideBestCard } from "./src/engine/rewards";
import {
  registerFavoriteGeofences,
  requestNudgePermissions,
  shouldNotifyNow
} from "./src/services/geofence";
import { loadJson, saveJson, storageKeys } from "./src/services/storage";
import {
  AppSettings,
  Card,
  Decision,
  Merchant,
  PaymentMethod,
  PurchaseChannel,
  UserOverride
} from "./src/types/domain";

type Tab = "recommend" | "favorites" | "cards" | "history";

const tabs: { key: Tab; label: string }[] = [
  { key: "recommend", label: "What Card?" },
  { key: "favorites", label: "Favorites" },
  { key: "cards", label: "Cards" },
  { key: "history", label: "History" }
];

const pct = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;

export default function App() {
  const [tab, setTab] = useState<Tab>("recommend");
  const [cards, setCards] = useState<Card[]>(seedCards);
  const [merchants] = useState<Merchant[]>(seedMerchants);
  const [favoriteMerchantIds, setFavoriteMerchantIds] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [settings, setSettings] = useState<AppSettings>(seedSettings);

  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(seedMerchants[0]!.id);
  const [channel, setChannel] = useState<PurchaseChannel>("in_store");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("apple_pay");
  const [nudgeAutomationEnabled, setNudgeAutomationEnabled] = useState<boolean>(false);

  const [newCardName, setNewCardName] = useState("");
  const [newCardNetwork, setNewCardNetwork] = useState("Visa");
  const [newCardDefaultRatePct, setNewCardDefaultRatePct] = useState("1");

  useEffect(() => {
    const hydrate = async () => {
      const [savedCards, savedFavorites, savedDecisions, savedOverrides, savedSettings] =
        await Promise.all([
          loadJson<Card[]>(storageKeys.cards),
          loadJson<string[]>(storageKeys.favorites),
          loadJson<Decision[]>(storageKeys.decisions),
          loadJson<UserOverride[]>(storageKeys.overrides),
          loadJson<AppSettings>(storageKeys.settings)
        ]);

      if (savedCards?.length) setCards(savedCards);
      if (savedFavorites) setFavoriteMerchantIds(savedFavorites);
      if (savedDecisions) setDecisions(savedDecisions);
      if (savedOverrides) setOverrides(savedOverrides);
      if (savedSettings) setSettings(savedSettings);
    };

    void hydrate();
  }, []);

  useEffect(() => {
    void saveJson(storageKeys.cards, cards);
  }, [cards]);

  useEffect(() => {
    void saveJson(storageKeys.favorites, favoriteMerchantIds);
  }, [favoriteMerchantIds]);

  useEffect(() => {
    void saveJson(storageKeys.decisions, decisions);
  }, [decisions]);

  useEffect(() => {
    void saveJson(storageKeys.overrides, overrides);
  }, [overrides]);

  useEffect(() => {
    void saveJson(storageKeys.settings, settings);
  }, [settings]);

  const selectedMerchant = useMemo(() => {
    const fallbackMerchant = merchants[0] ?? seedMerchants[0]!;
    return merchants.find((item) => item.id === selectedMerchantId) ?? fallbackMerchant;
  }, [merchants, selectedMerchantId]);

  const recommendation = useMemo(() => {
    return decideBestCard(cards, { merchant: selectedMerchant, channel, paymentMethod }, overrides);
  }, [cards, selectedMerchant, channel, paymentMethod, overrides]);

  const runnerUp = recommendation.scores[1];
  const bestCard = cards.find((card) => card.id === recommendation.decision.bestCardId);

  const toggleFavorite = (merchantId: string): void => {
    setFavoriteMerchantIds((prev) =>
      prev.includes(merchantId) ? prev.filter((id) => id !== merchantId) : [...prev, merchantId]
    );
  };

  const saveOverride = (merchantId: string, cardId: string): void => {
    setOverrides((prev) => {
      const filtered = prev.filter((item) => item.merchantId !== merchantId);
      return [...filtered, { merchantId, cardId }];
    });
  };

  const clearOverride = (merchantId: string): void => {
    setOverrides((prev) => prev.filter((item) => item.merchantId !== merchantId));
  };

  const logDecision = (accepted: boolean): void => {
    const logged: Decision = { ...recommendation.decision, accepted, timestamp: Date.now() };
    setDecisions((prev) => [logged, ...prev].slice(0, 200));
  };

  const enableAutomation = async (): Promise<void> => {
    const granted = await requestNudgePermissions();
    if (!granted) {
      Alert.alert("Permissions needed", "Enable always-on location + notifications for geofence nudges.");
      setNudgeAutomationEnabled(false);
      return;
    }

    const favorites = merchants.filter((merchant) => favoriteMerchantIds.includes(merchant.id));
    await registerFavoriteGeofences(favorites);
    setNudgeAutomationEnabled(true);
  };

  const createCard = (): void => {
    const normalized = Number(newCardDefaultRatePct);
    if (!newCardName.trim() || Number.isNaN(normalized)) {
      Alert.alert("Invalid card", "Provide a card name and numeric default reward percent.");
      return;
    }

    const newCard: Card = {
      id: `custom-${Date.now()}`,
      name: newCardName.trim(),
      network: newCardNetwork.trim() || "Other",
      rewardRules: [
        {
          id: `default-${Date.now()}`,
          rate: normalized / 100,
          note: "Default rule from custom card editor"
        }
      ]
    };

    setCards((prev) => [...prev, newCard]);
    setNewCardName("");
    setNewCardDefaultRatePct("1");
  };

  const maybeShowNudge = (): void => {
    const canNotify = shouldNotifyNow(settings, recommendation.deltaVsSecond);
    if (canNotify) {
      Alert.alert(
        "Meaningful win",
        `${bestCard?.name ?? "Best card"} is ahead by ${pct(recommendation.deltaVsSecond)} at ${selectedMerchant.name}.`
      );
    } else {
      Alert.alert(
        "No nudge",
        "Difference is below your threshold, in quiet hours, or throttled by anti-spam."
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Credit Card Teller</Text>
        <Text style={styles.subtitle}>Max rewards with explainable recommendations</Text>
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
            onPress={() => setTab(item.key)}
          >
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "recommend" && (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionLabel}>Merchant</Text>
          <HorizontalPicker
            options={merchants.map((merchant) => ({ id: merchant.id, label: merchant.name }))}
            selectedId={selectedMerchantId}
            onSelect={setSelectedMerchantId}
          />

          <Text style={styles.sectionLabel}>Channel</Text>
          <HorizontalPicker
            options={[
              { id: "in_store", label: "In-store" },
              { id: "online", label: "Online" }
            ]}
            selectedId={channel}
            onSelect={(value) => setChannel(value as PurchaseChannel)}
          />

          <Text style={styles.sectionLabel}>Payment method</Text>
          <HorizontalPicker
            options={[
              { id: "apple_pay", label: "Apple Pay" },
              { id: "physical_card", label: "Physical" },
              { id: "online_checkout", label: "Checkout" }
            ]}
            selectedId={paymentMethod}
            onSelect={(value) => setPaymentMethod(value as PaymentMethod)}
          />

          <View style={styles.recommendationCard}>
            <Text style={styles.cardHeadline}>Best card now</Text>
            <Text style={styles.bestCardName}>{bestCard?.name ?? "No result"}</Text>
            <Text style={styles.bestRate}>{pct(recommendation.decision.rate)}</Text>
            <Text style={styles.reason}>{recommendation.decision.reason}</Text>
            <Text style={styles.smallText}>
              Runner-up: {runnerUp ? `${runnerUp.cardName} at ${pct(runnerUp.rate)}` : "n/a"}
            </Text>
          </View>

          <View style={styles.row}>
            <Pressable style={styles.primaryButton} onPress={() => logDecision(true)}>
              <Text style={styles.primaryButtonText}>Accepted suggestion</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => logDecision(false)}>
              <Text style={styles.secondaryButtonText}>Dismissed</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Override for this merchant</Text>
          <HorizontalPicker
            options={cards.map((card) => ({ id: card.id, label: card.name }))}
            selectedId={recommendation.decision.bestCardId}
            onSelect={(id) => saveOverride(selectedMerchant.id, id)}
          />
          <Pressable style={styles.linkButton} onPress={() => clearOverride(selectedMerchant.id)}>
            <Text style={styles.linkText}>Clear override</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Nudge quality gate</Text>
          <Text style={styles.smallText}>
            Fire only if win is at least {pct(settings.nudgeDeltaThreshold)} and outside quiet hours.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={maybeShowNudge}>
            <Text style={styles.secondaryButtonText}>Simulate nudge decision</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Future feature</Text>
          <Text style={styles.smallText}>
            Expand merchant detection and recommendation confidence for online checkout flows.
          </Text>
        </ScrollView>
      )}

      {tab === "favorites" && (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.sectionLabel}>Geofence automation</Text>
              <Text style={styles.smallText}>Optional and limited to favorite stores only.</Text>
            </View>
            <Switch
              value={nudgeAutomationEnabled}
              onValueChange={(value) => {
                if (value) {
                  void enableAutomation();
                  return;
                }
                setNudgeAutomationEnabled(false);
              }}
            />
          </View>

          <Text style={styles.sectionLabel}>Favorite stores (top N)</Text>
          {merchants.map((merchant) => {
            const selected = favoriteMerchantIds.includes(merchant.id);
            return (
              <Pressable
                key={merchant.id}
                style={[styles.favoriteItem, selected && styles.favoriteItemActive]}
                onPress={() => toggleFavorite(merchant.id)}
              >
                <Text style={styles.favoriteName}>{merchant.name}</Text>
                <Text style={styles.smallText}>{selected ? "Monitoring" : "Not monitoring"}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {tab === "cards" && (
        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionLabel}>Saved cards</Text>
          {cards.map((card) => (
            <View style={styles.savedCard} key={card.id}>
              <Text style={styles.favoriteName}>{card.name}</Text>
              <Text style={styles.smallText}>{card.network}</Text>
              <Text style={styles.smallText}>{card.rewardRules.length} reward rule(s)</Text>
            </View>
          ))}

          <Text style={styles.sectionLabel}>Add custom card</Text>
          <TextInput
            style={styles.input}
            placeholder="Card name"
            value={newCardName}
            onChangeText={setNewCardName}
          />
          <TextInput
            style={styles.input}
            placeholder="Network"
            value={newCardNetwork}
            onChangeText={setNewCardNetwork}
          />
          <TextInput
            style={styles.input}
            placeholder="Default reward %"
            keyboardType="numeric"
            value={newCardDefaultRatePct}
            onChangeText={setNewCardDefaultRatePct}
          />
          <Pressable style={styles.primaryButton} onPress={createCard}>
            <Text style={styles.primaryButtonText}>Save card</Text>
          </Pressable>
        </ScrollView>
      )}

      {tab === "history" && (
        <View style={styles.page}>
          <Text style={styles.sectionLabel}>Decision log</Text>
          <FlatList
            data={decisions}
            keyExtractor={(item, index) => `${item.timestamp}-${index}`}
            renderItem={({ item }) => {
              const merchant = merchants.find((m) => m.id === item.merchantId);
              const card = cards.find((c) => c.id === item.bestCardId);
              return (
                <View style={styles.logItem}>
                  <Text style={styles.favoriteName}>{merchant?.name ?? item.merchantId}</Text>
                  <Text style={styles.smallText}>{card?.name ?? item.bestCardId}</Text>
                  <Text style={styles.smallText}>{pct(item.rate)}</Text>
                  <Text style={styles.smallText}>{item.accepted ? "Accepted" : "Dismissed"}</Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.smallText}>No events yet.</Text>}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function HorizontalPicker({
  options,
  selectedId,
  onSelect
}: {
  options: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerWrap}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.pickerOption, selected && styles.pickerOptionActive]}
          >
            <Text style={[styles.pickerText, selected && styles.pickerTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 13,
    color: "#334155",
    marginTop: 3
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 8
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#ffffff"
  },
  tabButtonActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a"
  },
  tabText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 12
  },
  tabTextActive: {
    color: "#f8fafc"
  },
  page: {
    flexGrow: 1,
    padding: 16,
    gap: 12
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b"
  },
  pickerWrap: {
    flexGrow: 0
  },
  pickerOption: {
    marginRight: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  pickerOptionActive: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9"
  },
  pickerText: {
    color: "#0f172a",
    fontWeight: "500"
  },
  pickerTextActive: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  recommendationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6
  },
  cardHeadline: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#475569"
  },
  bestCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  bestRate: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0284c7"
  },
  reason: {
    color: "#334155",
    lineHeight: 20
  },
  smallText: {
    color: "#475569",
    lineHeight: 19
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1
  },
  primaryButtonText: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700"
  },
  linkButton: {
    alignSelf: "flex-start",
    paddingVertical: 4
  },
  linkText: {
    color: "#0284c7",
    fontWeight: "600"
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14
  },
  settingTextWrap: {
    flex: 1
  },
  favoriteItem: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  favoriteItemActive: {
    borderColor: "#0ea5e9",
    backgroundColor: "#eff6ff"
  },
  favoriteName: {
    color: "#0f172a",
    fontWeight: "700"
  },
  savedCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 3
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  logItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 2
  }
});
