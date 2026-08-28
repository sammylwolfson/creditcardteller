import {
  MatchConfidence,
  Merchant,
  MerchantCategory,
  MerchantMatch,
  MerchantMatchResult
} from "../types/domain";

/**
 * Merchant matching.
 *
 * The app has to turn a messy string — a typed search, a card statement
 * descriptor like "SQ *TRADER JOES #204", or a checkout URL — into one of the
 * merchants we know reward rules for. Getting this wrong silently is worse
 * than admitting uncertainty, so every match comes back with a confidence
 * level and the runners-up, and the UI asks for confirmation below "high".
 */

/** Payment-processor prefixes and filler that carry no identifying signal. */
const NOISE_TOKENS = new Set([
  "sq",
  "tst",
  "pos",
  "pmnt",
  "payment",
  "purchase",
  "debit",
  "credit",
  "store",
  "shop",
  "inc",
  "llc",
  "ltd",
  "co",
  "corp",
  "company",
  "the",
  "usa",
  "us",
  "www",
  "com"
]);

/** Sub-domains that prefix a real merchant domain at checkout time. */
const DOMAIN_PREFIXES = ["www.", "m.", "shop.", "store.", "checkout.", "secure.", "order."];

export const normalizeText = (raw: string): string =>
  raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const tokenize = (raw: string): string[] =>
  normalizeText(raw)
    .split(" ")
    .filter((token) => token.length > 0)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !NOISE_TOKENS.has(token));

/** Pulls a bare domain out of a URL or a domain-like string. */
export const extractDomain = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const hostAndPath = withoutScheme.split(/[/?#]/)[0] ?? "";
  const host = hostAndPath.split("@").pop() ?? hostAndPath;
  const bare = host.split(":")[0] ?? host;

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(bare)) {
    return null;
  }

  let result = bare;
  for (const prefix of DOMAIN_PREFIXES) {
    if (result.startsWith(prefix)) {
      result = result.slice(prefix.length);
    }
  }
  return result;
};

const levenshtein = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  let prev: number[] = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      row.push(
        Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      );
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
};

const similarity = (a: string, b: string): number => {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) {
    return 0;
  }
  return 1 - levenshtein(a, b) / longest;
};

const jaccard = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const containment = (query: string[], candidate: string[]): number => {
  if (query.length === 0 || candidate.length === 0) {
    return 0;
  }
  const candidateSet = new Set(candidate);
  const hits = query.filter((token) => candidateSet.has(token)).length;
  return hits / query.length;
};

/** Names the matcher will compare a query against for one merchant. */
const surfaceForms = (merchant: Merchant): string[] => [
  merchant.name,
  merchant.id.replace(/-/g, " "),
  ...(merchant.aliases ?? [])
];

interface Scored {
  score: number;
  via: MerchantMatch["via"];
}

const scoreMerchant = (
  merchant: Merchant,
  queryNormalized: string,
  queryTokens: string[],
  queryDomain: string | null
): Scored => {
  let best: Scored = { score: 0, via: "fuzzy" };
  const take = (score: number, via: MerchantMatch["via"]): void => {
    if (score > best.score) {
      best = { score, via };
    }
  };

  if (queryDomain) {
    for (const domain of merchant.domains ?? []) {
      const normalizedDomain = domain.toLowerCase();
      if (queryDomain === normalizedDomain || queryDomain.endsWith(`.${normalizedDomain}`)) {
        take(0.99, "domain");
      }
    }
  }

  for (const form of surfaceForms(merchant)) {
    const formNormalized = normalizeText(form);
    if (!formNormalized) {
      continue;
    }
    const isAlias = form !== merchant.name;
    const via: MerchantMatch["via"] = isAlias ? "alias" : "name";

    if (formNormalized === queryNormalized) {
      take(isAlias ? 0.97 : 1, via);
      continue;
    }

    // "costco whse 1043" should still land on Costco.
    if (
      queryNormalized.length >= 4 &&
      formNormalized.length >= 4 &&
      (queryNormalized.startsWith(formNormalized) || formNormalized.startsWith(queryNormalized))
    ) {
      take(0.88, via);
    }

    const formTokens = tokenize(form);
    const covered = containment(queryTokens, formTokens);

    // Identical token sets mean the strings differ only by noise, order or
    // punctuation: "SQ *TRADER JOES #204" is Trader Joe's, not a maybe.
    if (
      queryTokens.length > 0 &&
      covered === 1 &&
      containment(formTokens, queryTokens) === 1
    ) {
      take(0.95, "token");
    } else if (covered === 1 && queryTokens.length > 0) {
      // The query is a subset of the name ("costco" inside "costco gas").
      take(0.86, "token");
    } else if (covered > 0) {
      take(0.5 + 0.3 * covered, "token");
    }

    take(0.75 * jaccard(queryTokens, formTokens), "token");

    const fuzzy = similarity(queryNormalized, formNormalized);
    if (fuzzy >= 0.7) {
      take(0.7 * fuzzy, "fuzzy");
    }
  }

  return best;
};

export interface MatchOptions {
  /** Normalized query -> merchant id, learned from user confirmations. */
  learnedAliases?: Record<string, string>;
  /** How many alternatives to return. */
  limit?: number;
}

const describeConfidence = (
  confidence: MatchConfidence,
  best: MerchantMatch | null,
  runnerUp: MerchantMatch | null
): string => {
  if (!best) {
    return "No merchant in your list looks like that. Pick a category and the engine will still rank your cards.";
  }

  switch (confidence) {
    case "high":
      return `Matched ${best.merchant.name} on its ${best.via === "domain" ? "checkout domain" : best.via === "learned" ? "saved spelling" : "name"}.`;
    case "ambiguous":
      return `${best.merchant.name} and ${runnerUp?.merchant.name ?? "another store"} both look close. Confirm which one you are at.`;
    case "medium":
      return `Probably ${best.merchant.name}, but the spelling is not an exact match. Confirm before trusting the rate.`;
    case "low":
      return `Weak match on ${best.merchant.name}. Confirm it or pick a category instead.`;
  }
};

export const matchMerchant = (
  query: string,
  merchants: Merchant[],
  options: MatchOptions = {}
): MerchantMatchResult => {
  const limit = options.limit ?? 5;
  const queryNormalized = normalizeText(query);
  const queryTokens = tokenize(query);
  const queryDomain = extractDomain(query);

  const empty: MerchantMatchResult = {
    query,
    confidence: "low",
    best: null,
    candidates: [],
    explanation: describeConfidence("low", null, null),
    needsConfirmation: true
  };

  if (!queryNormalized) {
    return empty;
  }

  const learnedId = options.learnedAliases?.[queryNormalized];
  const learned = learnedId ? merchants.find((item) => item.id === learnedId) : undefined;
  if (learned) {
    const match: MerchantMatch = { merchant: learned, score: 1, via: "learned" };
    return {
      query,
      confidence: "high",
      best: match,
      candidates: [match],
      explanation: describeConfidence("high", match, null),
      needsConfirmation: false
    };
  }

  const ranked: MerchantMatch[] = merchants
    .map((merchant) => {
      const { score, via } = scoreMerchant(merchant, queryNormalized, queryTokens, queryDomain);
      return { merchant, score: Math.round(score * 1000) / 1000, via };
    })
    .filter((match) => match.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const best = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  if (!best) {
    return empty;
  }

  const lead = best.score - (runnerUp?.score ?? 0);
  let confidence: MatchConfidence;
  if (runnerUp && lead < 0.08) {
    confidence = "ambiguous";
  } else if (best.score >= 0.9) {
    confidence = "high";
  } else if (best.score >= 0.65) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    query,
    confidence,
    best,
    candidates: ranked,
    explanation: describeConfidence(confidence, best, runnerUp),
    needsConfirmation: confidence !== "high"
  };
};

/** Geofence regions carry the merchant id, so this is an exact lookup. */
export const matchByRegionId = (
  regionId: string,
  merchants: Merchant[]
): MerchantMatchResult => {
  const merchant = merchants.find((item) => item.id === regionId);
  if (!merchant) {
    return {
      query: regionId,
      confidence: "low",
      best: null,
      candidates: [],
      explanation: `Geofence fired for an unknown region "${regionId}".`,
      needsConfirmation: true
    };
  }

  const match: MerchantMatch = { merchant, score: 1, via: "id" };
  return {
    query: regionId,
    confidence: "high",
    best: match,
    candidates: [match],
    explanation: `You are inside the geofence you saved for ${merchant.name}.`,
    needsConfirmation: false
  };
};

/**
 * Builds a throwaway merchant for a place we do not know, so an unmatched
 * search still produces a real recommendation instead of a dead end.
 */
export const adHocMerchant = (name: string, category: MerchantCategory): Merchant => ({
  id: `adhoc:${normalizeText(name).replace(/ /g, "-") || "unknown"}`,
  name: name.trim() || "Unknown merchant",
  category,
  isCustom: true
});

/** Records a user confirmation so the same descriptor matches next time. */
export const learnAlias = (
  learned: Record<string, string>,
  query: string,
  merchantId: string
): Record<string, string> => {
  const key = normalizeText(query);
  if (!key) {
    return learned;
  }
  return { ...learned, [key]: merchantId };
};
