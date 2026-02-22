import type { Item } from '../types/api';

/**
 * Simple English plural stemmer for list item names.
 * Handles common plural forms without a full NLP library.
 */
function stemWord(word: string): string {
  if (word.length <= 2) return word;

  // ies → y (berries → berry, cherries → cherry)
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  }

  // ves → f (loaves → loaf, halves → half)
  if (word.endsWith('ves') && word.length > 4) {
    return word.slice(0, -3) + 'f';
  }

  // ses, xes, zes, ches, shes → remove 'es'
  if (word.length > 4 && word.endsWith('es')) {
    const base = word.slice(0, -2);
    if (
      base.endsWith('s') ||
      base.endsWith('x') ||
      base.endsWith('z') ||
      base.endsWith('ch') ||
      base.endsWith('sh')
    ) {
      return base;
    }
    // oes → o (tomatoes → tomato, potatoes → potato)
    if (base.endsWith('o')) {
      return base;
    }
  }

  // General 's' removal (eggs → egg, cucumbers → cucumber)
  // Skip words ending in 'ss' (glass, moss) or 'us' (hummus)
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Normalize and stem a name for comparison.
 * Lowercases, trims, collapses whitespace, and stems each word.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(stemWord)
    .join(' ');
}

/**
 * Compute Levenshtein edit distance between two strings.
 * Uses single-row DP for O(min(m,n)) space.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) return editDistance(b, a);

  const m = a.length;
  const n = b.length;

  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let curr = new Array<number>(m + 1);

  for (let j = 1; j <= n; j++) {
    curr[0] = j;
    for (let i = 1; i <= m; i++) {
      if (a[i - 1] === b[j - 1]) {
        curr[i] = prev[i - 1];
      } else {
        curr[i] = 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  return prev[m];
}

/**
 * Maximum allowed edit distance based on string length.
 * Conservative thresholds to minimize false positives.
 */
function maxAllowedDistance(length: number): number {
  if (length <= 4) return 0; // Too short — "milk" vs "silk" is 1 edit but different items
  if (length <= 7) return 1; // "chicken" (7) allows 1 typo
  return 2; // Longer strings allow 2 typos
}

/**
 * Check if two item names are fuzzy duplicates.
 * Returns 'exact' for case-insensitive match, 'fuzzy' for stem/typo match, or null.
 */
export function getFuzzyMatchType(
  nameA: string,
  nameB: string,
): 'exact' | 'fuzzy' | null {
  const normA = nameA.toLowerCase().trim();
  const normB = nameB.toLowerCase().trim();

  // Exact match (case-insensitive)
  if (normA === normB) return 'exact';

  // Stem match (plural normalization)
  const stemA = normalizeName(nameA);
  const stemB = normalizeName(nameB);

  if (stemA === stemB) return 'fuzzy';

  // Edit distance on stemmed versions
  const minLen = Math.min(stemA.length, stemB.length);
  const maxDist = maxAllowedDistance(minLen);

  if (maxDist === 0) return null;

  const dist = editDistance(stemA, stemB);

  // Must be within absolute threshold AND within 30% of shortest string length
  if (dist <= maxDist && dist / minLen <= 0.3) {
    return 'fuzzy';
  }

  return null;
}

export type DuplicateMatchType = 'exact' | 'fuzzy';

export interface DuplicateResult {
  match: Item;
  isDone: boolean;
  matchType: DuplicateMatchType;
}

/**
 * Find an existing item that duplicates the given name.
 *
 * Checks in order:
 * 1. Exact (case-insensitive) match — prefers unchecked, falls back to checked
 * 2. Fuzzy (stem/typo) match — unchecked items only (done-item fuzzy matches are too noisy)
 */
export function findDuplicateItem(items: Item[], name: string): DuplicateResult | null {
  // --- Pass 1: exact match (all items, prefer unchecked) ---
  const normalized = name.toLowerCase().trim();
  let checkedExact: Item | null = null;

  for (const item of items) {
    if (item.name.toLowerCase().trim() !== normalized) continue;
    if (!item.is_checked) return { match: item, isDone: false, matchType: 'exact' };
    if (!checkedExact) checkedExact = item;
  }

  if (checkedExact) return { match: checkedExact, isDone: true, matchType: 'exact' };

  // --- Pass 2: fuzzy match (unchecked items only) ---
  const stemmedInput = normalizeName(name);
  let bestFuzzy: Item | null = null;
  let bestDistance = Infinity;

  for (const item of items) {
    if (item.is_checked) continue;

    const stemmedItem = normalizeName(item.name);

    // Stem-equal is the strongest fuzzy signal
    if (stemmedItem === stemmedInput) {
      return { match: item, isDone: false, matchType: 'fuzzy' };
    }

    // Edit distance check
    const minLen = Math.min(stemmedInput.length, stemmedItem.length);
    const maxDist = maxAllowedDistance(minLen);
    if (maxDist === 0) continue;

    const dist = editDistance(stemmedInput, stemmedItem);
    if (dist <= maxDist && dist / minLen <= 0.3 && dist < bestDistance) {
      bestDistance = dist;
      bestFuzzy = item;
    }
  }

  if (bestFuzzy) return { match: bestFuzzy, isDone: false, matchType: 'fuzzy' };

  return null;
}

/**
 * Find the best fuzzy match for a name among a list of existing items.
 * Used by NLParseModal for duplicate indicators.
 * Checks all items (both checked and unchecked) since the modal shows different messages.
 */
export function findFuzzyMatch(
  existingItems: Item[],
  name: string,
): { match: Item; matchType: DuplicateMatchType } | null {
  const normalized = name.toLowerCase().trim();
  const stemmedInput = normalizeName(name);

  let bestExactChecked: Item | null = null;
  let bestFuzzyUnchecked: Item | null = null;
  let bestFuzzyChecked: Item | null = null;
  let bestDistUnchecked = Infinity;
  let bestDistChecked = Infinity;

  for (const item of existingItems) {
    const itemNorm = item.name.toLowerCase().trim();

    // Exact match — prefer unchecked
    if (itemNorm === normalized) {
      if (!item.is_checked) return { match: item, matchType: 'exact' };
      if (!bestExactChecked) bestExactChecked = item;
      continue;
    }

    // Fuzzy: stem match
    const stemmedItem = normalizeName(item.name);
    if (stemmedItem === stemmedInput) {
      if (!item.is_checked) return { match: item, matchType: 'fuzzy' };
      if (!bestFuzzyChecked) bestFuzzyChecked = item;
      continue;
    }

    // Fuzzy: edit distance
    const minLen = Math.min(stemmedInput.length, stemmedItem.length);
    const maxDist = maxAllowedDistance(minLen);
    if (maxDist === 0) continue;

    const dist = editDistance(stemmedInput, stemmedItem);
    if (dist <= maxDist && dist / minLen <= 0.3) {
      if (!item.is_checked && dist < bestDistUnchecked) {
        bestDistUnchecked = dist;
        bestFuzzyUnchecked = item;
      } else if (item.is_checked && dist < bestDistChecked) {
        bestDistChecked = dist;
        bestFuzzyChecked = item;
      }
    }
  }

  // Return in priority order: exact checked > fuzzy unchecked > fuzzy checked
  if (bestExactChecked) return { match: bestExactChecked, matchType: 'exact' };
  if (bestFuzzyUnchecked) return { match: bestFuzzyUnchecked, matchType: 'fuzzy' };
  if (bestFuzzyChecked) return { match: bestFuzzyChecked, matchType: 'fuzzy' };

  return null;
}
