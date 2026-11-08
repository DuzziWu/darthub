/**
 * Reward claim service for Career Mode.
 *
 * Tracks which rewards a user has already claimed to prevent duplicates.
 * In-memory store for now; replace with Prisma repository later.
 */

export interface RewardClaimResult {
  success: boolean;
  reason?: string;
  unlockables?: string[];
}

export interface RewardClaimRecord {
  userId: string;
  rewardId: string;
  claimedAt: Date;
}

export interface RewardStore {
  hasClaimed(userId: string, rewardId: string): Promise<boolean>;
  recordClaim(userId: string, rewardId: string): Promise<void>;
}

/** In-memory reward store for tests and MVP. */
export function createInMemoryRewardStore(): RewardStore & {
  getClaims(userId: string): RewardClaimRecord[];
} {
  const claims = new Map<string, RewardClaimRecord[]>();

  return {
    async hasClaimed(userId, rewardId) {
      const userClaims = claims.get(userId) ?? [];
      return userClaims.some((c) => c.rewardId === rewardId);
    },
    async recordClaim(userId, rewardId) {
      const userClaims = claims.get(userId) ?? [];
      userClaims.push({ userId, rewardId, claimedAt: new Date() });
      claims.set(userId, userClaims);
    },
    getClaims(userId) {
      return claims.get(userId) ?? [];
    },
  };
}

export interface RewardService {
  claimReward(userId: string, rewardId: string): Promise<RewardClaimResult>;
}

export function createRewardService(rewardStore: RewardStore): RewardService {
  return {
    async claimReward(userId: string, rewardId: string): Promise<RewardClaimResult> {
      if (await rewardStore.hasClaimed(userId, rewardId)) {
        return { success: false, reason: "Already claimed" };
      }
      await rewardStore.recordClaim(userId, rewardId);
      // Unlockables are resolved by the caller via quest definitions.
      return { success: true };
    },
  };
}
