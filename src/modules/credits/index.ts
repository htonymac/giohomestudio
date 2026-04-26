// GioHomeStudio — Finance Phase 2: Credit middleware
//
// Primitives for tracking credits without touching real billing.
// 1 credit = $0.001 USD. Markup: 2x for video, 3x for everything else.
//
// These helpers are NOT wired into any generation route yet.
// That wiring is Phase 2b — we're only building the plumbing here.

import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import { getModelById } from "@/lib/generation/model-registry";

// ── Constants ───────────────────────────────────────────────────────────
export const DEFAULT_USER_ID = "default_user";
export const DEFAULT_USER_EMAIL = "default@local";
export const DEFAULT_FREE_CREDITS = 100;
export const CREDIT_USD_VALUE = 0.001; // 1 credit = $0.001

// ── Types ───────────────────────────────────────────────────────────────
export interface CostPreview {
  credits: number;        // how many credits will be deducted
  costToHenry: number;    // USD Henry pays the provider
  priceToUser: number;    // USD value the user sees
}

export interface ReserveMeta {
  modelUsed?: string;
  costToHenry?: number;
  generationRef?: string;
}

// ── Pricing overrides (same source as /api/settings/models) ─────────────
const OVERRIDES_PATH = path.join(process.cwd(), "storage", "config", "pricing-overrides.json");

function readOverrides(): Record<string, { cost_to_henry?: number; price_to_user?: number }> {
  if (!fs.existsSync(OVERRIDES_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
  } catch {
    return {};
  }
}

function markupForType(type: string): number {
  return type === "video" ? 2 : 3;
}

// ── Default user ────────────────────────────────────────────────────────
// Idempotent: returns existing default_user or creates it.
export async function getDefaultUser() {
  const existing = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      id: DEFAULT_USER_ID,
      email: DEFAULT_USER_EMAIL,
      tier: "FREE",
      creditBalance: DEFAULT_FREE_CREDITS,
    },
  });
}

// ── Balance query ───────────────────────────────────────────────────────
export async function getBalance(userId: string): Promise<{ balance: number; tier: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true, tier: true },
  });
  if (!user) throw new Error(`User not found: ${userId}`);
  return { balance: user.creditBalance, tier: user.tier };
}

// ── Cost preview ────────────────────────────────────────────────────────
// Reads model registry + pricing overrides, returns credit + USD breakdown.
export function previewCost(modelId: string): CostPreview {
  const model = getModelById(modelId);
  if (!model) throw new Error(`Model not found: ${modelId}`);

  const overrides = readOverrides();
  const o = overrides[modelId];
  const costToHenry = o?.cost_to_henry ?? model.cost_to_henry;
  const userOverride = o?.price_to_user ?? model.price_to_user;

  // If a user price override exists, honour it; otherwise derive from markup.
  const markup = markupForType(model.type);
  const priceToUser = userOverride && userOverride > 0
    ? userOverride
    : costToHenry * markup;

  const credits = Math.max(1, Math.round(priceToUser / CREDIT_USD_VALUE));

  return { credits, costToHenry, priceToUser };
}

// ── Reserve ─────────────────────────────────────────────────────────────
// Atomically: check balance, decrement it, create a `reserve` transaction.
// Throws if balance < amount.
export async function reserveCredits(
  userId: string,
  amount: number,
  reason: string,
  meta: ReserveMeta = {}
): Promise<string> {
  if (amount <= 0) throw new Error(`reserveCredits: amount must be > 0 (got ${amount})`);

  const [txId] = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    if (!user) throw new Error(`User not found: ${userId}`);
    if (user.creditBalance < amount) {
      throw new Error(`Insufficient credits: have ${user.creditBalance}, need ${amount}`);
    }

    const newBalance = user.creditBalance - amount;

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });

    const txn = await tx.creditTransaction.create({
      data: {
        userId,
        type: "reserve",
        amount,
        reason,
        costToHenry: meta.costToHenry,
        modelUsed: meta.modelUsed,
        generationRef: meta.generationRef,
        balanceAfter: newBalance,
      },
      select: { id: true },
    });

    return [txn.id];
  });

  return txId;
}

// ── Commit ──────────────────────────────────────────────────────────────
// Flips the transaction type from `reserve` to `deduct`.
// No balance change — balance was already decremented on reserve.
export async function commitReservation(reservationTxId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.creditTransaction.findUnique({
      where: { id: reservationTxId },
      select: { id: true, type: true },
    });
    if (!existing) throw new Error(`Reservation not found: ${reservationTxId}`);
    if (existing.type !== "reserve") {
      throw new Error(`Cannot commit non-reserve transaction (type=${existing.type})`);
    }

    await tx.creditTransaction.update({
      where: { id: reservationTxId },
      data: { type: "deduct" },
    });
  });
}

// ── Release ─────────────────────────────────────────────────────────────
// Refunds the reserved amount: bumps balance back, logs a `refund` row.
export async function releaseReservation(reservationTxId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const reserve = await tx.creditTransaction.findUnique({
      where: { id: reservationTxId },
    });
    if (!reserve) throw new Error(`Reservation not found: ${reservationTxId}`);
    if (reserve.type !== "reserve") {
      throw new Error(`Cannot release non-reserve transaction (type=${reserve.type})`);
    }

    const user = await tx.user.findUnique({
      where: { id: reserve.userId },
      select: { creditBalance: true },
    });
    if (!user) throw new Error(`User not found: ${reserve.userId}`);

    const newBalance = user.creditBalance + reserve.amount;

    await tx.user.update({
      where: { id: reserve.userId },
      data: { creditBalance: newBalance },
    });

    // Leave the original reserve row in place, but mark it as refunded for audit trail.
    await tx.creditTransaction.update({
      where: { id: reservationTxId },
      data: { type: "refund" },
    });

    await tx.creditTransaction.create({
      data: {
        userId: reserve.userId,
        type: "refund",
        amount: reserve.amount,
        reason: `release:${reserve.reason}`,
        costToHenry: reserve.costToHenry,
        modelUsed: reserve.modelUsed,
        generationRef: reserve.generationRef,
        balanceAfter: newBalance,
      },
    });
  });
}
