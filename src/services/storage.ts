import AsyncStorage from "@react-native-async-storage/async-storage";

export const storageKeys = {
  cards: "cct.cards",
  favorites: "cct.favorites",
  decisions: "cct.decisions",
  overrides: "cct.overrides",
  settings: "cct.settings"
};

export const loadJson = async <T>(key: string): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const saveJson = async <T>(key: string, value: T): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};
