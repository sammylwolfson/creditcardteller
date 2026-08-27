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
    traits: ["warehouse_club"],
    aliases: ["costco", "costco whse", "costco wholesale corp", "costco warehouse"],
    acceptedNetworks: ["Visa"],
    supportsApplePay: true,
    radiusMeters: 150
  },
  {
    id: "costco-online",
    name: "Costco.com",
    category: "wholesale_club",
    traits: ["warehouse_club"],
    aliases: ["costco online", "costco com", "costco dot com"],
    domains: ["costco.com"],
    acceptedNetworks: ["Visa"],
    supportsApplePay: false
  },
  {
    id: "costco-gas",
    name: "Costco Gas Station",
    category: "gas",
    traits: ["warehouse_club"],
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
    traits: ["specialty_store"],
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
    traits: ["specialty_store"],
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
  },
  {
    id: "target",
    name: "Target",
    category: "department_store",
    traits: ["superstore"],
    aliases: ["target store", "target com"],
    domains: ["target.com"],
    supportsApplePay: true,
    radiusMeters: 120
  },
  {
    id: "walmart",
    name: "Walmart",
    category: "department_store",
    traits: ["superstore"],
    aliases: ["wal mart", "walmart supercenter", "wmt"],
    domains: ["walmart.com"],
    supportsApplePay: false,
    radiusMeters: 150
  },
  {
    id: "safeway",
    name: "Safeway",
    category: "grocery",
    aliases: ["safeway store"],
    domains: ["safeway.com"],
    supportsApplePay: true,
    radiusMeters: 90
  },
  {
    id: "kroger",
    name: "Kroger",
    category: "grocery",
    aliases: ["kroger store", "krogers"],
    domains: ["kroger.com"],
    supportsApplePay: true,
    radiusMeters: 90
  },
  {
    id: "ralphs",
    name: "Ralphs",
    category: "grocery",
    aliases: ["ralphs grocery", "ralph s"],
    domains: ["ralphs.com"],
    supportsApplePay: true,
    radiusMeters: 90
  },
  {
    id: "sprouts",
    name: "Sprouts Farmers Market",
    category: "grocery",
    aliases: ["sprouts", "sprouts market"],
    domains: ["sprouts.com"],
    supportsApplePay: true,
    radiusMeters: 80
  },
  {
    id: "aldi",
    name: "Aldi",
    category: "grocery",
    aliases: ["aldi store"],
    supportsApplePay: true,
    radiusMeters: 80
  },
  {
    id: "sams-club",
    name: "Sam's Club",
    category: "wholesale_club",
    traits: ["warehouse_club"],
    aliases: ["sams club", "sam club", "samsclub"],
    domains: ["samsclub.com"],
    supportsApplePay: true,
    radiusMeters: 150
  },
  {
    id: "bjs",
    name: "BJ's Wholesale Club",
    category: "wholesale_club",
    traits: ["warehouse_club"],
    aliases: ["bjs", "bjs wholesale", "bj s club"],
    domains: ["bjs.com"],
    supportsApplePay: true,
    radiusMeters: 150
  },
  {
    id: "sams-club-gas",
    name: "Sam's Club Fuel Center",
    category: "gas",
    aliases: ["sams club gas", "sams club fuel", "samsclub fuel"],
    traits: ["warehouse_club"],
    supportsApplePay: true,
    radiusMeters: 80
  },
  {
    id: "chevron",
    name: "Chevron",
    category: "gas",
    aliases: ["chevron gas", "chevron station"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "arco",
    name: "ARCO",
    category: "gas",
    aliases: ["arco gas", "arco ampm"],
    supportsApplePay: false,
    radiusMeters: 60
  },
  {
    id: "rite-aid",
    name: "Rite Aid",
    category: "drugstore",
    aliases: ["riteaid", "rite aid pharmacy"],
    domains: ["riteaid.com"],
    supportsApplePay: true,
    radiusMeters: 70
  },
  {
    id: "subway",
    name: "Subway",
    category: "restaurant",
    aliases: ["subway sandwiches"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "panera",
    name: "Panera Bread",
    category: "restaurant",
    aliases: ["panera", "panera bread co"],
    domains: ["panerabread.com"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "in-n-out",
    name: "In-N-Out Burger",
    category: "restaurant",
    aliases: ["in n out", "innout", "in-n-out"],
    supportsApplePay: false,
    radiusMeters: 60
  },
  {
    id: "taco-bell",
    name: "Taco Bell",
    category: "restaurant",
    aliases: ["tacobell"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "sweetgreen",
    name: "Sweetgreen",
    category: "restaurant",
    aliases: ["sweet green"],
    domains: ["sweetgreen.com"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "dunkin",
    name: "Dunkin'",
    category: "restaurant",
    aliases: ["dunkin donuts", "dunkin"],
    supportsApplePay: true,
    radiusMeters: 60
  },
  {
    id: "doordash",
    name: "DoorDash",
    category: "restaurant",
    aliases: ["door dash", "dd doordash"],
    domains: ["doordash.com"],
    supportsApplePay: true
  },
  {
    id: "best-buy",
    name: "Best Buy",
    category: "department_store",
    traits: ["specialty_store"],
    aliases: ["bestbuy", "best buy store"],
    domains: ["bestbuy.com"],
    supportsApplePay: true,
    radiusMeters: 100
  },
  {
    id: "lowes",
    name: "Lowe's",
    category: "home_improvement",
    traits: ["specialty_store"],
    aliases: ["lowes", "lowes home improvement"],
    domains: ["lowes.com"],
    supportsApplePay: true,
    radiusMeters: 120
  },
  {
    id: "ikea",
    name: "IKEA",
    category: "home_improvement",
    traits: ["specialty_store"],
    aliases: ["ikea store"],
    domains: ["ikea.com"],
    supportsApplePay: true,
    radiusMeters: 150
  },
  {
    id: "rei",
    name: "REI",
    category: "department_store",
    traits: ["specialty_store"],
    aliases: ["rei co op", "recreational equipment"],
    domains: ["rei.com"],
    supportsApplePay: true,
    radiusMeters: 90
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "streaming",
    aliases: ["spotify usa", "spotify premium"],
    domains: ["spotify.com"],
    supportsApplePay: false
  },
  {
    id: "hulu",
    name: "Hulu",
    category: "streaming",
    aliases: ["hulu com"],
    domains: ["hulu.com"],
    supportsApplePay: false
  },
  {
    id: "lyft",
    name: "Lyft",
    category: "transit",
    aliases: ["lyft ride", "lyft inc"],
    domains: ["lyft.com"],
    supportsApplePay: true
  },
  {
    id: "united",
    name: "United Airlines",
    category: "airline",
    aliases: ["united", "united air", "ual"],
    domains: ["united.com"],
    supportsApplePay: false
  },
  {
    id: "airbnb",
    name: "Airbnb",
    category: "travel",
    aliases: ["air bnb", "airbnb inc"],
    domains: ["airbnb.com"],
    supportsApplePay: true
  },
  {
    id: "hilton",
    name: "Hilton",
    category: "hotel",
    aliases: ["hilton hotels", "hilton honors"],
    domains: ["hilton.com"],
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
  geofenceEnabled: false,
  // Off by default: the amortised view is only as good as the spend estimate.
  amortiseAnnualFees: false,
  assumedAnnualSpend: 24000
};
