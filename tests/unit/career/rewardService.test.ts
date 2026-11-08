import { describe, expect, it } from "vitest";
import { createRewardService, createInMemoryRewardStore } from "@/career/rewardService";

describe("rewardService", () => {
  describe("claimReward", () => {
    it("allows first-time reward claim", async () => {
      const store = createInMemoryRewardStore();
      const service = createRewardService(store);

      const result = await service.claimReward("user-1", "reward-tier-1");
      expect(result.success).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("prevents duplicate reward claims", async () => {
      const store = createInMemoryRewardStore();
      const service = createRewardService(store);

      await service.claimReward("user-1", "reward-tier-1");
      const second = await service.claimReward("user-1", "reward-tier-1");
      expect(second.success).toBe(false);
      expect(second.reason).toBe("Already claimed");
    });

    it("returns unlockables on successful claim", async () => {
      const store = createInMemoryRewardStore();
      const service = createRewardService(store);

      const result = await service.claimReward("user-1", "reward-tier-1");
      expect(result.success).toBe(true);
    });

    it("allows different users to claim the same reward", async () => {
      const store = createInMemoryRewardStore();
      const service = createRewardService(store);

      await service.claimReward("user-1", "reward-tier-1");
      const result = await service.claimReward("user-2", "reward-tier-1");
      expect(result.success).toBe(true);
    });
  });
});
