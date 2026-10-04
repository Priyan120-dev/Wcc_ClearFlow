import { PayerAlias } from '@/lib/types';

/**
 * Normalizes customer or business names for robust matching:
 * - Uppercase
 * - Strips common corporate suffixes ("PVT LTD", "LLP", "ENTERPRISES", etc.)
 * - Strips non-alphanumeric characters
 */
export function normalizeBusinessName(name: string): string {
  if (!name) return '';
  let clean = name.toUpperCase().trim();

  // Strip corporate suffixes and generic industry tags
  const suffixes = [
    /\bPRIVATE\s+LIMITED\b/g,
    /\bPVT\s*\.?\s*LTD\b/g,
    /\bLIMITED\b/g,
    /\bLTD\b/g,
    /\bLLP\b/g,
    /\bENTERPRISES\b/g,
    /\bENTERPRISE\b/g,
    /\bENTP\b/g,
    /\bSOLUTIONS\b/g,
    /\bSERVICES\b/g,
    /\bTRADERS\b/g,
    /\bTRADER\b/g,
    /\bTRADING\b/g,
    /\bINDUSTRIAL\b/g,
    /\bINDUSTRIES\b/g,
    /\bINDUSTRY\b/g,
    /\bCORP\b/g,
    /\bCORPORATION\b/g,
    /\bCO\b/g,
    /\bINC\b/g,
  ];

  for (const s of suffixes) {
    clean = clean.replace(s, ' ');
  }

  // Remove non-alphanumeric except spaces
  clean = clean.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

/**
 * Computes Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Computes normalized string similarity (0.0 to 1.0)
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.trim();
  const s2 = b.trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Token-based similarity: splits into words, compares best-match word pairs.
 * Invariant: Requires the primary customer proper noun to match.
 */
export function tokenSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeBusinessName(str1);
  const norm2 = normalizeBusinessName(str2);

  if (!norm1 || !norm2) return 0.0;
  if (norm1 === norm2) return 1.0;
  if (norm2.includes(norm1) || norm1.includes(norm2)) return 0.90;

  const tokens1 = norm1.split(' ').filter(Boolean);
  const tokens2 = norm2.split(' ').filter(Boolean);

  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  // In business names, the primary identifier is typically the first distinctive name (e.g. "Sharma", "Gupta", "Patel")
  // If the primary identifier has < 0.60 similarity with every word in narration, penalize score to 0
  const primaryToken = tokens1[0];
  if (primaryToken && primaryToken.length >= 3) {
    let bestPrimarySim = 0;
    for (const t2 of tokens2) {
      const sim = stringSimilarity(primaryToken, t2);
      if (sim > bestPrimarySim) bestPrimarySim = sim;
    }
    if (bestPrimarySim < 0.60) {
      return 0.0;
    }
  }

  let totalScore = 0;
  for (const t1 of tokens1) {
    let maxSim = 0;
    for (const t2 of tokens2) {
      const sim = stringSimilarity(t1, t2);
      if (sim > maxSim) maxSim = sim;
    }
    totalScore += maxSim;
  }

  const score1 = totalScore / tokens1.length;

  let reverseTotal = 0;
  for (const t2 of tokens2) {
    let maxSim = 0;
    for (const t1 of tokens1) {
      const sim = stringSimilarity(t1, t2);
      if (sim > maxSim) maxSim = sim;
    }
    reverseTotal += maxSim;
  }
  const score2 = reverseTotal / tokens2.length;

  return Math.max(score1, score2);
}

/**
 * Evaluates customer name against bank narration and saved payer aliases:
 * name_score = max(fuzzy_similarity, alias_hit ? 1.0 : 0.0)
 */
export function calculateNameScore(
  customerName: string,
  narration: string,
  aliases: PayerAlias[] = []
): { score: number; isAliasHit: boolean; matchedAlias?: string } {
  const normCustomer = normalizeBusinessName(customerName);
  const normNarration = normalizeBusinessName(narration);

  // 1. Check saved payer aliases first
  for (const alias of aliases) {
    const normAlias = normalizeBusinessName(alias.raw_alias);
    const normTargetCustomer = normalizeBusinessName(alias.customer_name);

    if (normTargetCustomer === normCustomer && normAlias.length >= 3 && normNarration.includes(normAlias)) {
      return {
        score: 1.0,
        isAliasHit: true,
        matchedAlias: alias.raw_alias,
      };
    }
  }

  // 2. Token-level fuzzy match
  const fuzzy = tokenSimilarity(customerName, narration);
  return {
    score: Math.min(1.0, Math.max(0.0, fuzzy)),
    isAliasHit: false,
  };
}
