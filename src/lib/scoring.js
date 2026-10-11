export const DAY = 86_400;

export const lpPoints = (share) => (share >= 0.9 ? 15 : share >= 0.5 ? 8 : 0); 
export const creatorPoints = (share) => (share >= 0.8 ? 15 : share >= 0.4 ? 8 : 0); 
export const agePoints = (days) => (days < 1 ? 0 : days < 7 ? 3 : days <= 30 ? 6 : 10);
export const supplyPoints = (share) => (share <= 0.3 ? 10 : share <= 0.5 ? 7 : share <= 0.8 ? 3 : 0); 
export const nftPoints = (heldDays) => (heldDays > 30 ? 10 : 0);

const sum = (xs) => xs.reduce((s, x) => s + x, 0n);
const pct = (a, b) => Number((a * 10000n) / b) / 100;

export function vestingRemaining(v, now) {
  const start = Number(v.start), dur = Number(v.duration), end = start + dur;
  if (end <= now) return 0n;
  if (dur === 0 || now <= start) return v.amount;
  return (v.amount * BigInt(end - now)) / BigInt(dur);
}
const daysLeft = (v, now) => (Number(v.start) + Number(v.duration) - now) / DAY;

export function creatorShare({ platform, authors, creatorBalance, now }) {
  const mine = (a) => authors.has(a.toLowerCase());
  const own = platform.vestings.filter((v) => mine(v.creator));
  const remainingAny = sum(own.map((v) => vestingRemaining(v, now)));
  const locked = sum(own.filter((v) => daysLeft(v, now) >= 90).map((v) => vestingRemaining(v, now)));
  const burned = sum([...platform.burns, ...platform.disposals].filter((b) => mine(b.sender)).map((b) => b.amount));
  const base = creatorBalance + remainingAny + burned;
  return base === 0n ? undefined : Number(((locked + burned) * 10000n) / base) / 10000;
}

export function distribution({ holders, totalSupply, burned, platform, exclude, walletBalances, now }) {
  const circulating = totalSupply - burned;
  if (circulating <= 0n) return undefined;
  const skip = new Set([...exclude, "0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"]);
  const wallets = new Set((platform?.vestings ?? []).map((v) => v.wallet.toLowerCase()));
  const lpLike = (h) => h.address.is_contract && /pair|pool|liquidity|\blp\b/i.test(h.address.name ?? "");

  const who = new Map();
  const entry = (a) => who.get(a) ?? who.set(a, { address: a, liquid: 0n, locked: 0n, soon: 0n }).get(a);
  for (const h of holders) {
    const a = h.address.hash.toLowerCase();
    if (skip.has(a) || wallets.has(a) || lpLike(h)) continue;
    entry(a).liquid += BigInt(h.value);
  }
  for (const v of platform?.vestings ?? []) {
    const bal = walletBalances.get(v.wallet.toLowerCase()) ?? vestingRemaining(v, now);
    const left = daysLeft(v, now), e = entry(v.beneficiary.toLowerCase());
    if (left >= 90) e.locked += bal;
    else if (left >= 30) e.liquid += bal; 
    else e.soon += bal;
  }
  const ranked = [...who.values()].filter((e) => e.liquid + e.soon > 0n).sort((a, b) => Number(b.liquid + b.soon - (a.liquid + a.soon))).slice(0, 10);
  return {
    share: Number((sum(ranked.map((e) => e.liquid + e.soon)) * 10000n) / circulating) / 10000,
    rows: ranked.map((e) => ({ address: e.address, liquid: pct(e.liquid, circulating), locked: pct(e.locked, circulating), soon: pct(e.soon, circulating) })),
  };
}

export function computeScore(blocks, sellBlock) {
  const out = blocks.map((b) => {
    const av = b.parts.filter((p) => p.available);
    return { ...b, earned: av.reduce((s, p) => s + p.points, 0), possible: av.reduce((s, p) => s + p.max, 0), partial: av.length < b.parts.length, unavailable: av.length === 0 };
  });
  const earned = out.reduce((s, b) => s + b.earned, 0), possible = out.reduce((s, b) => s + b.possible, 0);
  let score = possible ? Math.round((earned / possible) * 100) : 0;
  const capped = sellBlock && score > 10;
  if (sellBlock) score = Math.min(score, 10);
  const risk = score >= 80 ? "Low" : score >= 60 ? "Moderate" : score >= 30 ? "High" : "Critical";
  return { score, risk, coverage: possible, blocks: out, capped };
}