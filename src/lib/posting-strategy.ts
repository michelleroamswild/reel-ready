import type {
  AccountState,
  FollowerTier,
  MomentumMode,
  PostingStrategy,
  PostingSlot,
  VariantSimilarityPair,
} from "@/types/posting-strategy";
import type { ReelWithDetails } from "@/types/reel";

// ─── Account Classification ─────────────────────────────────────────

export function classifyFollowerTier(count: number): FollowerTier {
  if (count < 1_000) return "emerging";
  if (count < 10_000) return "growing";
  if (count < 100_000) return "established";
  return "large";
}

export function classifyMomentum(
  trend: AccountState["performanceTrend"],
  postsPerWeek: number
): MomentumMode {
  if (trend === "rising") return "high";
  if (trend === "declining") return "low";
  return postsPerWeek >= 2 ? "high" : "low";
}

// ─── Text Similarity (Jaccard on word bigrams) ──────────────────────

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const tokens = new Set<string>();
  for (const w of words) tokens.add(w);
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]} ${words[i + 1]}`);
  }
  return tokens;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Shared Video Ratio ─────────────────────────────────────────────

function sharedVideoRatio(
  segmentsA: { video_id: string }[],
  segmentsB: { video_id: string }[]
): number {
  const idsA = new Set(segmentsA.map((s) => s.video_id));
  const idsB = new Set(segmentsB.map((s) => s.video_id));
  if (idsA.size === 0 && idsB.size === 0) return 1;
  if (idsA.size === 0 || idsB.size === 0) return 0;
  let shared = 0;
  for (const id of idsA) {
    if (idsB.has(id)) shared++;
  }
  const union = new Set([...idsA, ...idsB]).size;
  return shared / union;
}

// ─── Pairwise Similarity ───────────────────────────────────────────

export function computePairSimilarity(
  reelA: ReelWithDetails,
  reelB: ReelWithDetails
): VariantSimilarityPair {
  const videoRatio = sharedVideoRatio(
    reelA.reel_segments,
    reelB.reel_segments
  );

  const textA = reelA.reel_segments.map((s) => s.section_text).join(" ");
  const textB = reelB.reel_segments.map((s) => s.section_text).join(" ");
  const textSim = jaccardSimilarity(tokenize(textA), tokenize(textB));

  const sameType =
    reelA.trial_variant_type === reelB.trial_variant_type;

  const composite = Math.min(
    1,
    videoRatio * 0.45 + textSim * 0.35 + (sameType ? 1 : 0) * 0.2
  );

  return {
    reelIdA: reelA.id,
    reelIdB: reelB.id,
    sharedVideoRatio: videoRatio,
    textSimilarity: textSim,
    sameVariantType: sameType,
    compositeSimilarity: composite,
  };
}

export function buildSimilarityMatrix(
  reels: ReelWithDetails[]
): VariantSimilarityPair[] {
  const pairs: VariantSimilarityPair[] = [];
  for (let i = 0; i < reels.length; i++) {
    for (let j = i + 1; j < reels.length; j++) {
      pairs.push(computePairSimilarity(reels[i], reels[j]));
    }
  }
  return pairs;
}

// ─── Cadence Determination ──────────────────────────────────────────

interface CadenceParams {
  baseDays: number;
  minDays: number;
  maxDays: number;
}

function baseCadence(
  tier: FollowerTier,
  momentum: MomentumMode
): CadenceParams {
  if (momentum === "high") {
    switch (tier) {
      case "emerging":
        return { baseDays: 1.5, minDays: 1, maxDays: 2 };
      case "growing":
        return { baseDays: 1.5, minDays: 1, maxDays: 2 };
      case "established":
        return { baseDays: 1, minDays: 1, maxDays: 1.5 };
      case "large":
        return { baseDays: 1, minDays: 1, maxDays: 1 };
    }
  } else {
    switch (tier) {
      case "emerging":
        return { baseDays: 3.5, minDays: 3, maxDays: 4 };
      case "growing":
        return { baseDays: 2.5, minDays: 2, maxDays: 3 };
      case "established":
        return { baseDays: 2.5, minDays: 2, maxDays: 3 };
      case "large":
        return { baseDays: 1.5, minDays: 1, maxDays: 2 };
    }
  }
}

function adjustedCadenceDays(
  base: CadenceParams,
  pairSimilarity: number,
  accountPostsPerWeek: number
): number {
  const minAllowedDays = 7 / (accountPostsPerWeek * 2);
  const similarityPenalty = 1 + pairSimilarity;
  let days = base.baseDays * similarityPenalty;
  days = Math.max(base.minDays, Math.min(base.maxDays * 2, days));
  days = Math.max(days, minAllowedDays);
  return Math.round(days * 2) / 2; // round to nearest 0.5
}

// ─── Novelty Score ──────────────────────────────────────────────────

function noveltyScore(
  reel: ReelWithDetails,
  baseReel: ReelWithDetails | null
): number {
  if (!baseReel) return 0.5;

  const baseVideoIds = new Set(baseReel.reel_segments.map((s) => s.video_id));
  const reelVideoIds = new Set(reel.reel_segments.map((s) => s.video_id));
  let shared = 0;
  for (const id of reelVideoIds) {
    if (baseVideoIds.has(id)) shared++;
  }
  const totalUnique = new Set([...baseVideoIds, ...reelVideoIds]).size;
  const videoNovelty = totalUnique > 0 ? 1 - shared / totalUnique : 0;

  const baseText = baseReel.reel_segments.map((s) => s.section_text).join(" ");
  const reelText = reel.reel_segments.map((s) => s.section_text).join(" ");
  const textNovelty = 1 - jaccardSimilarity(tokenize(baseText), tokenize(reelText));

  const typeBonus =
    reel.trial_variant_type === "audio"
      ? 0.15
      : reel.trial_variant_type === "visual"
        ? 0.1
        : 0;

  return Math.min(1, videoNovelty * 0.5 + textNovelty * 0.35 + typeBonus);
}

// ─── Ordering (greedy max-diversity) ────────────────────────────────

function findPairSimilarity(
  idA: string,
  idB: string,
  pairs: VariantSimilarityPair[]
): number {
  const pair = pairs.find(
    (p) =>
      (p.reelIdA === idA && p.reelIdB === idB) ||
      (p.reelIdA === idB && p.reelIdB === idA)
  );
  return pair?.compositeSimilarity ?? 0;
}

export function determinePostingOrder(
  reels: ReelWithDetails[],
  baseReel: ReelWithDetails | null,
  pairs: VariantSimilarityPair[]
): ReelWithDetails[] {
  if (reels.length <= 1) return [...reels];

  const scored = reels.map((reel) => ({
    reel,
    novelty: noveltyScore(reel, baseReel),
  }));
  scored.sort((a, b) => b.novelty - a.novelty);

  const ordered: ReelWithDetails[] = [scored[0].reel];
  const remaining = new Set(scored.slice(1).map((s) => s.reel.id));

  while (remaining.size > 0) {
    const lastId = ordered[ordered.length - 1].id;
    let bestId = "";
    let bestSim = Infinity;

    for (const candidateId of remaining) {
      const sim = findPairSimilarity(lastId, candidateId, pairs);
      if (sim < bestSim) {
        bestSim = sim;
        bestId = candidateId;
      }
    }

    ordered.push(reels.find((r) => r.id === bestId)!);
    remaining.delete(bestId);
  }

  return ordered;
}

// ─── Risk Score (0-100) ─────────────────────────────────────────────

export function computeRiskScore(
  slots: PostingSlot[],
  pairs: VariantSimilarityPair[],
  account: AccountState,
  cadenceDays: number
): number {
  if (slots.length <= 1) return 0;

  // Adjacent similarity (0-40 pts)
  let adjSimSum = 0;
  let adjCount = 0;
  for (let i = 0; i < slots.length - 1; i++) {
    const sim = findPairSimilarity(slots[i].reelId, slots[i + 1].reelId, pairs);
    adjSimSum += sim;
    adjCount++;
  }
  const avgAdjSim = adjCount > 0 ? adjSimSum / adjCount : 0;
  const similarityRisk = avgAdjSim * 40;

  // Frequency deviation (0-30 pts)
  const normalDays = 7 / account.postsPerWeek;
  const ratio = normalDays / cadenceDays;
  const frequencyRisk = Math.min(30, Math.max(0, (ratio - 1) * 30));

  // Batch size (0-15 pts)
  const countRisk = Math.min(15, Math.max(0, (slots.length - 3) * 3.75));

  // Type concentration (0-15 pts)
  const typeCounts = new Map<string, number>();
  for (const slot of slots) {
    typeCounts.set(slot.variantType, (typeCounts.get(slot.variantType) ?? 0) + 1);
  }
  const maxTypeCount = Math.max(...typeCounts.values());
  const concentration = maxTypeCount / slots.length;
  const idealSpread = 1 / typeCounts.size;
  const typeRisk = Math.max(0, (concentration - idealSpread) * 15);

  return Math.round(Math.min(100, similarityRisk + frequencyRisk + countRisk + typeRisk));
}

// ─── Confidence Score (0-100) ───────────────────────────────────────

export function computeConfidenceScore(
  reels: ReelWithDetails[],
  pairs: VariantSimilarityPair[],
  cadenceDays: number
): number {
  if (reels.length <= 1) return 20;

  // Type diversity (0-35 pts)
  const types = new Set(reels.map((r) => r.trial_variant_type));
  const typeDiversity = types.size >= 3 ? 35 : types.size === 2 ? 22 : 10;

  // Controlled variables (0-30 pts): sweet spot at 0.3-0.6 avg similarity
  const avgSim =
    pairs.length > 0
      ? pairs.reduce((s, p) => s + p.compositeSimilarity, 0) / pairs.length
      : 0;
  let controlScore: number;
  if (avgSim >= 0.3 && avgSim <= 0.6) {
    controlScore = 30;
  } else if (avgSim < 0.3) {
    controlScore = 30 * (avgSim / 0.3);
  } else {
    controlScore = 30 * (1 - (avgSim - 0.6) / 0.4);
  }

  // Spacing (0-20 pts)
  const spacingScore = Math.min(20, cadenceDays * 10);

  // Variant count (0-15 pts)
  const countScore = Math.min(15, Math.max(0, reels.length * 3 - 6 + 9));

  return Math.round(
    Math.min(100, typeDiversity + controlScore + spacingScore + countScore)
  );
}

// ─── Rationale ──────────────────────────────────────────────────────

function slotRationale(
  index: number,
  reel: ReelWithDetails,
  prevPairSim: number | null,
  momentum: MomentumMode
): string {
  const type = reel.trial_variant_type ?? "unknown";
  if (index === 0) {
    return momentum === "high"
      ? "Leading with the most novel variant to capitalize on algorithmic freshness."
      : "Starting with the most differentiated variant to signal a fresh content direction.";
  }
  if (prevPairSim !== null && prevPairSim < 0.3) {
    return `Strong contrast from the previous post — different ${type} approach keeps the feed fresh.`;
  }
  if (prevPairSim !== null && prevPairSim < 0.6) {
    return `Moderate variation from the previous post. Tests a distinct ${type} angle while maintaining familiarity.`;
  }
  return "Similar content to the previous post — the extra spacing helps prevent audience fatigue.";
}

function summaryRationale(
  reelCount: number,
  cadenceDays: number,
  riskScore: number,
  confidenceScore: number,
  types: string[]
): string {
  const cadenceLabel =
    cadenceDays <= 1 ? "daily" : `every ${Math.round(cadenceDays * 10) / 10} days`;

  let text = `Posting ${cadenceLabel} balances experiment clarity with audience engagement. `;
  text += `Your ${reelCount} variants test ${types.join(", ")} variations. `;

  if (riskScore > 60) {
    text += `Risk is elevated (${riskScore}/100) due to content similarity — consider removing the most similar variant. `;
  } else if (riskScore > 35) {
    text += `Risk is moderate (${riskScore}/100). Posting order is optimized to maximize variety between adjacent posts. `;
  } else {
    text += `Risk is low (${riskScore}/100) — your variants are sufficiently diverse. `;
  }

  if (confidenceScore > 70) {
    text += `Experiment clarity is high (${confidenceScore}/100), so you should get clear learnings about what resonates.`;
  } else if (confidenceScore > 40) {
    text += `Experiment clarity is moderate (${confidenceScore}/100). For stronger learnings, ensure each variant isolates a single change.`;
  } else {
    text += `Experiment clarity is limited (${confidenceScore}/100). Consider adding more variant types or increasing spacing.`;
  }

  return text;
}

function generateWarnings(
  slots: PostingSlot[],
  pairs: VariantSimilarityPair[],
  account: AccountState,
  cadenceDays: number
): string[] {
  const warnings: string[] = [];

  for (let i = 0; i < slots.length - 1; i++) {
    const sim = findPairSimilarity(slots[i].reelId, slots[i + 1].reelId, pairs);
    if (sim > 0.7) {
      warnings.push(
        `Posts ${i + 1} and ${i + 2} share very similar content (${Math.round(sim * 100)}% similarity). Consider removing one.`
      );
    }
  }

  const normalDays = 7 / account.postsPerWeek;
  if (cadenceDays < normalDays / 2) {
    warnings.push(
      "Recommended cadence is more than 2x your normal posting rate. This may trigger algorithmic throttling."
    );
  }

  const types = new Set(slots.map((s) => s.variantType));
  if (types.size === 1 && slots.length > 2) {
    warnings.push(
      `All variants are "${[...types][0]}" type. Testing across multiple types yields stronger learnings.`
    );
  }

  const totalDays =
    slots.length > 1 ? slots[slots.length - 1].dayOffset - slots[0].dayOffset : 0;
  if (totalDays < 3 && slots.length > 3) {
    warnings.push(
      `The entire experiment runs in ${totalDays} days. Consider spreading posts for cleaner data.`
    );
  }

  return warnings;
}

// ─── Main Entry Point ───────────────────────────────────────────────

export function recommendPostingStrategy(
  trialReels: ReelWithDetails[],
  accountState: AccountState,
  baseReel?: ReelWithDetails | null
): PostingStrategy {
  const followerTier = classifyFollowerTier(accountState.followerCount);
  const momentumMode = classifyMomentum(
    accountState.performanceTrend,
    accountState.postsPerWeek
  );

  if (trialReels.length === 0) {
    return {
      slots: [],
      riskScore: 0,
      confidenceScore: 0,
      cadenceDescription: "N/A",
      summaryRationale: "No trial reels to schedule.",
      warnings: ["No variant reels found in this batch."],
      accountClassification: { followerTier, momentumMode },
    };
  }

  // Similarity
  const pairs = buildSimilarityMatrix(trialReels);

  // Order
  const ordered = determinePostingOrder(trialReels, baseReel ?? null, pairs);

  // Cadence
  const base = baseCadence(followerTier, momentumMode);

  // Build slots
  const today = new Date();
  const slots: PostingSlot[] = [];
  let dayOffset = 0;

  for (let i = 0; i < ordered.length; i++) {
    const reel = ordered[i];

    if (i > 0) {
      const prevSim = findPairSimilarity(ordered[i - 1].id, reel.id, pairs);
      dayOffset += adjustedCadenceDays(base, prevSim, accountState.postsPerWeek);
    }

    const postDate = new Date(today);
    postDate.setDate(postDate.getDate() + Math.round(dayOffset));

    const prevSim =
      i > 0 ? findPairSimilarity(ordered[i - 1].id, reel.id, pairs) : null;
    const nextSim =
      i < ordered.length - 1
        ? findPairSimilarity(reel.id, ordered[i + 1].id, pairs)
        : null;

    slots.push({
      dayOffset: Math.round(dayOffset),
      date: postDate.toISOString().split("T")[0],
      reelId: reel.id,
      reelTitle: reel.title,
      variantType: reel.trial_variant_type ?? "unknown",
      variantLabel: reel.trial_variant_label ?? "",
      rationale: slotRationale(i, reel, prevSim, momentumMode),
      similarityToNext: nextSim,
    });
  }

  // Average cadence
  const avgCadence =
    slots.length > 1
      ? slots[slots.length - 1].dayOffset / (slots.length - 1)
      : base.baseDays;

  // Scores
  const riskScore = computeRiskScore(slots, pairs, accountState, avgCadence);
  const confidenceScore = computeConfidenceScore(trialReels, pairs, avgCadence);

  // Rationale
  const variantTypes = [...new Set(trialReels.map((r) => r.trial_variant_type ?? "unknown"))];
  const summary = summaryRationale(
    trialReels.length,
    avgCadence,
    riskScore,
    confidenceScore,
    variantTypes
  );
  const warnings = generateWarnings(slots, pairs, accountState, avgCadence);

  // Cadence label
  const cadenceDescription =
    avgCadence <= 1
      ? "Daily"
      : avgCadence <= 1.5
        ? "Every 1-2 days"
        : `Every ${Math.round(avgCadence)} days`;

  return {
    slots,
    riskScore,
    confidenceScore,
    cadenceDescription,
    summaryRationale: summary,
    warnings,
    accountClassification: { followerTier, momentumMode },
  };
}
