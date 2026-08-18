import { AppSettings, Card, Merchant } from "../types/domain";

export const seedCards: Card[] = [
  {
    id: "costco-anywhere-visa",
    name: "Costco Anywhere Visa (Citi)",
    network: "Visa",
    rewardRules: [
      {
        id: "costco-restaurant",
        category: "restaurant",
        rate: 0.03,
        conditions: { channel: ["in_store", "online"] },
        note: "Restaurants earn 3%"
      },
      {
        id: "costco-travel",
        category: "travel",
        rate: 0.03,
        conditions: { channel: ["in_store", "online"] },
        note: "Eligible travel earns 3%"
      },
      {
        id: "costco-warehouse",
        merchantId: "costco",
        rate: 0.02,
        conditions: { channel: ["in_store", "online"] },
        note: "Costco and Costco.com earn 2%"
      },
      {
        id: "costco-default",
        rate: 0.01,
        note: "All other purchases earn 1%"
      }
    ]
  },
  {
    id: "apple-card",
    name: "Apple Card",
    network: "Mastercard",
    rewardRules: [
      {
        id: "apple-partner-costco-online",
        merchantId: "costco-online",
        rate: 0.03,
        conditions: { channel: ["online"] },
        note: "Example partner merchant earns 3%"
      },
      {
        id: "apple-partner-uber",
        merchantId: "uber",
        rate: 0.03,
        conditions: { channel: ["online", "in_store"] },
        note: "Partner merchant earns 3%"
      },
      {
        id: "apple-pay",
        rate: 0.02,
        conditions: {
          paymentMethod: ["apple_pay"],
          channel: ["in_store", "online"]
        },
        note: "Apple Pay earns 2%"
      },
      {
        id: "apple-physical",
        rate: 0.01,
        conditions: { paymentMethod: ["physical_card", "online_checkout"] },
        note: "Physical card or non-Apple Pay checkout earns 1%"
      }
    ]
  }
];

export const seedMerchants: Merchant[] = [
  {
    id: "costco",
    name: "Costco Warehouse",
    category: "warehouse",
    supportsApplePay: true,
    radiusMeters: 120
  },
  {
    id: "pavilions",
    name: "Pavilions",
    category: "grocery",
    supportsApplePay: true,
    radiusMeters: 90
  },
  {
    id: "mcdonalds",
    name: "McDonald's",
    category: "restaurant",
    supportsApplePay: true,
    radiusMeters: 80
  },
  {
    id: "costco-online",
    name: "Costco.com",
    category: "online",
    supportsApplePay: false
  },
  {
    id: "uber",
    name: "Uber",
    category: "travel",
    supportsApplePay: true
  }
];

export const seedSettings: AppSettings = {
  nudgeDeltaThreshold: 0.01,
  quietHoursStart: 22,
  quietHoursEnd: 7
};
