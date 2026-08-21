import { AppSettings, Merchant } from "../types/domain";

/**
 * Seed merchant catalogue.
 *
 * `aliases` exist so the matcher can recognise the messy strings that show up
 * in the real world (POS descriptors, abbreviations, app names). `domains`
 * cover the online path. Locations are deliberately absent: the user pins a
 * store from the Favorites tab using their actual GPS position, because
 * hard-coded coordinates would be wrong for everyone but one person.
 */
export const seedMerchants: Merchant[] = [
  {
    id: "costco",
    name: "Costco Wholesale",
    category: "wholesale_club",
    aliases: ["costco", "costco whse", "costco wholesale corp", "costco warehouse"],
    acceptedNetworks: ["Visa"],
    supportsApplePay: true,
    radiusMeters: 150
  },
  {
    id: "costco-online",
    name: "Costco.com",
    category: "wholesale_club",
    aliases: ["costco online", "costco com", "costco dot com"],
    domains: ["costco.com"],
    acceptedNetworks: ["Visa"],
    supportsApplePay: false
  },
  {
    id: "costco-gas",
    name: "Costco Gas Station",
    category: "gas",
    aliases: ["costco gas", "costco fuel", "costco gasoline"],
    acceptedNetworks: ["Visa"],
    supportsApplePay: false,
    radiusMeters: 100
  },
  {
    id: "pavilions",
    name: "Pavilions",
    category: "grocery",
    aliases: ["pavilions market", "vons pavilions", "pavillions"],
    domains: ["pavilions.com"],
    supportsApplePay: true,
    radiusMeters: 90
  },
  {
    id: "trader-joes",
    name: "Trader Joe's",
    category: "grocery",
    aliases: ["trader joes", "traderjoes", "tjs", "trader joe"],
    supportsApplePay: true,
    radiusMeters: 80
  },
  {
    id: "whole-foods",
    name: "Whole Foods Market",
    category: "grocery",
    aliases: ["whole foods", "wholefoods", "wfm", "amazon whole foods"],
    domains: ["wholefoodsmarket.com"],
    supportsApplePay: true,
    radiusMeters: 80
  },
  {
    id: "mcdonalds",
    name: "McDonald's",
    category: "restaurant",
    aliases: ["mcdonalds", "mc donalds", "mcd", "mickey ds"],
    domains: ["mcdonalds.com"],
    supportsApplePay: true,
    radiusMeters: 70
  },
  {
    id: "chipotle",
    name: "Chipotle Mexican Grill",
    category: "restaurant",
    aliases: ["chipotle", "chipotle mexican"],
    domains: ["chipotle.com"],
    supportsApplePay: true,
    radiusMeters: 70
  },
  {
    id: "starbucks",
    name: "Starbucks",
    category: "restaurant",
    aliases: ["starbucks coffee", "sbux"],
    domains: ["starbucks.com"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "walgreens",
    name: "Walgreens",
    category: "drugstore",
    aliases: ["walgreens pharmacy", "walgreen"],
    domains: ["walgreens.com"],
    supportsApplePay: true,
    radiusMeters: 70
  },
  {
    id: "cvs",
    name: "CVS Pharmacy",
    category: "drugstore",
    aliases: ["cvs", "cvs pharmacy", "cvs health"],
    domains: ["cvs.com"],
    supportsApplePay: true,
    radiusMeters: 70
  },
  {
    id: "shell",
    name: "Shell",
    category: "gas",
    aliases: ["shell oil", "shell gas", "shell station"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "exxon-mobil",
    name: "Exxon Mobil",
    category: "gas",
    aliases: ["exxon", "mobil", "exxonmobil"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "uber",
    name: "Uber",
    category: "transit",
    aliases: ["uber trip", "uber ride", "uber technologies"],
    domains: ["uber.com"],
    supportsApplePay: true
  },
  {
    id: "amazon",
    name: "Amazon",
    category: "online_retail",
    aliases: ["amazon com", "amzn", "amazon marketplace", "amazon mktp"],
    domains: ["amazon.com", "amzn.com"],
    supportsApplePay: false
  },
  {
    id: "apple-store",
    name: "Apple Store",
    category: "online_retail",
    aliases: ["apple", "apple com", "apple retail"],
    domains: ["apple.com"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "nike",
    name: "Nike",
    category: "department_store",
    aliases: ["nike store", "nike com"],
    domains: ["nike.com"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "netflix",
    name: "Netflix",
    category: "streaming",
    aliases: ["netflix com", "netflix subscription"],
    domains: ["netflix.com"],
    supportsApplePay: false
  },
  {
    id: "home-depot",
    name: "The Home Depot",
    category: "home_improvement",
    aliases: ["home depot", "homedepot", "thd"],
    domains: ["homedepot.com"],
    supportsApplePay: true,
    radiusMeters: 120
  },
  {
    id: "delta",
    name: "Delta Air Lines",
    category: "airline",
    aliases: ["delta", "delta airlines", "delta air"],
    domains: ["delta.com"],
    supportsApplePay: false
  },
  {
    id: "marriott",
    name: "Marriott",
    category: "hotel",
    aliases: ["marriott hotels", "marriott bonvoy"],
    domains: ["marriott.com"],
    supportsApplePay: false
  }
];

export const seedSettings: AppSettings = {
  nudgeDeltaThreshold: 0.01,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  globalCooldownMinutes: 45,
  perMerchantCooldownMinutes: 240,
  defaultPaymentMethod: "apple_pay",
  geofenceEnabled: false
};
