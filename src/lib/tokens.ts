import type { Card, ResolvedCard } from "./types";

interface TokenSpec {
  name: string;
  qty: number;
}

const TOKEN_CREATE = /\bcreate[sd]?\s+([^\n.]+?)\s+tokens?\b/gi;

function parsePiece(piece: string): TokenSpec {
  const s = piece.trim();
  const numMatch = s.match(/^(\d+)\s+(.+)$/);
  if (numMatch) return { qty: parseInt(numMatch[1], 10) || 1, name: numMatch[2].trim() };
  const articleMatch = s.match(/^an?\s+(.+)$/i);
  if (articleMatch) return { qty: 1, name: articleMatch[1].trim() };
  return { qty: 1, name: s };
}

/**
 * Pulls "create a/an/N <Name> token(s)" phrases out of a card's rules text.
 * Multi-token phrases ("a Might and a Vigor token", "X or Y token") are split
 * on and/or so every named token gets its own spec — good enough to flag
 * which token cards a deck needs, not a full rules parser.
 */
export function extractTokenSpecs(functionalText: string): TokenSpec[] {
  const specs: TokenSpec[] = [];
  let match: RegExpExecArray | null;
  TOKEN_CREATE.lastIndex = 0;
  while ((match = TOKEN_CREATE.exec(functionalText))) {
    match[1]
      .split(/\s*,\s*|\s+and\s+|\s+or\s+/i)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((piece) => specs.push(parsePiece(piece)));
  }
  return specs;
}

/**
 * Scans the resolved decklist for token-creating text and returns the token
 * cards it implies, skipping anything the user already listed manually.
 */
export function collectAutoTokens(
  resolvedCards: ResolvedCard[],
  dbIndex: Map<string, Card[]> | null
): ResolvedCard[] {
  if (!dbIndex) return [];
  const existingNames = new Set(resolvedCards.map((r) => r.card.name.toLowerCase()));
  const qtyByName = new Map<string, number>();
  resolvedCards.forEach((entry) => {
    extractTokenSpecs(entry.card.functional_text).forEach((spec) => {
      const key = spec.name.toLowerCase();
      qtyByName.set(key, Math.max(qtyByName.get(key) || 1, spec.qty));
    });
  });
  const tokens: ResolvedCard[] = [];
  let i = 0;
  qtyByName.forEach((qty, key) => {
    if (existingNames.has(key)) return;
    const matches = dbIndex.get(key) || [];
    const card = matches.find((c) => (c.types || []).some((t) => t.toLowerCase() === "token"));
    if (!card) return;
    tokens.push({
      id: "token" + i++ + "-" + Date.now(),
      name: card.name,
      qty,
      card,
      printing: card.printings[0] || null,
    });
  });
  return tokens;
}
