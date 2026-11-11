import { describe, expect, it } from "vitest";
import { createFriendService } from "@/friends/FriendService";
import type { FriendRepository, FriendRow } from "@/friends/repository";

// In-memory test double matching the FriendRepository interface
const createInMemoryFriendRepository = () => {
  const friends: Map<string, FriendRow> = new Map();
  const users: Map<string, { id: string; email: string; displayName: string }> = new Map();

  const userStore = {
    findById: async (id: string) => users.get(id) ?? null,
  };

  const friendStore = {
    findFriend: async (requesterId: string, addresseeId: string) => {
      for (const f of friends.values()) {
        if (f.requesterId === requesterId && f.addresseeId === addresseeId) return f;
      }
      return null;
    },
    findFriendsByUser: async (userId: string) => {
      const result: FriendRow[] = [];
      for (const f of friends.values()) {
        if ((f.addresseeId === userId || f.requesterId === userId) && f.status === "ACCEPTED") {
          result.push(f);
        }
      }
      return result;
    },
    findPendingForAddressee: async (addresseeId: string) => {
      const result: FriendRow[] = [];
      for (const f of friends.values()) {
        if (f.addresseeId === addresseeId && f.status === "PENDING") result.push(f);
      }
      return result;
    },
    createFriend: async (requesterId: string, addresseeId: string) => {
      const row: FriendRow = {
        id: crypto.randomUUID(),
        requesterId,
        addresseeId,
        status: "PENDING",
        createdAt: new Date(),
        respondedAt: null,
      };
      friends.set(row.id, row);
      return row;
    },
    updateStatus: async (id: string, status: "ACCEPTED" | "DECLINED") => {
      const row = friends.get(id);
      if (!row) throw new Error("Friend row not found");
      const updated = { ...row, status, respondedAt: new Date() };
      friends.set(id, updated);
      return updated;
    },
    deleteFriend: async (id: string) => friends.delete(id),
  };

  const addUser = (id: string, email: string, displayName: string) => {
    users.set(id, { id, email, displayName });
  };

  const addFriend = (row: FriendRow) => friends.set(row.id, row);

  return {
    users: userStore,
    friends: friendStore,
    addUser,
    addFriend,
    runInTransaction: async <T>(
      fn: (tx: import("@/friends/repository").FriendUnitOfWork) => Promise<T>,
    ) => fn({} as import("@/friends/repository").FriendUnitOfWork),
  };
};

describe("friend system", () => {
  describe("send friend request", () => {
    it("sends a friend request from user A to user B", async () => {
      const repo = createInMemoryFriendRepository();
      repo.addUser("user-a", "a@test.com", "User A");
      repo.addUser("user-b", "b@test.com", "User B");

      const service = createFriendService({ repository: repo as unknown as FriendRepository });
      const result = await service.sendFriendRequest({
        requesterId: "user-a",
        addresseeId: "user-b",
      });

      expect(result.status).toBe("PENDING");
      expect(result.requesterId).toBe("user-a");
      expect(result.addresseeId).toBe("user-b");
    });

    it("validates that both users exist", async () => {
      const repo = createInMemoryFriendRepository();
      repo.addUser("user-a", "a@test.com", "User A");

      const service = createFriendService({ repository: repo as unknown as FriendRepository });

      await expect(
        service.sendFriendRequest({ requesterId: "user-a", addresseeId: "nonexistent" }),
      ).rejects.toThrow("User not found");
    });

    it("prevents duplicate friend entries", async () => {
      const repo = createInMemoryFriendRepository();
      repo.addUser("user-a", "a@test.com", "User A");
      repo.addUser("user-b", "b@test.com", "User B");

      const service = createFriendService({ repository: repo as unknown as FriendRepository });
      await service.sendFriendRequest({ requesterId: "user-a", addresseeId: "user-b" });

      await expect(
        service.sendFriendRequest({ requesterId: "user-a", addresseeId: "user-b" }),
      ).rejects.toThrow("Friend request already exists");
    });
  });

  describe("accept friend request", () => {
    it("allows user B to accept the request", async () => {
      const repo = createInMemoryFriendRepository();
      repo.addUser("user-a", "a@test.com", "User A");
      repo.addUser("user-b", "b@test.com", "User B");

      const service = createFriendService({ repository: repo as unknown as FriendRepository });
      const request = await service.sendFriendRequest({
        requesterId: "user-a",
        addresseeId: "user-b",
      });

      const accepted = await service.acceptFriendRequest({
        requestId: request.id,
        userId: "user-b",
      });
      expect(accepted.status).toBe("ACCEPTED");
    });
  });

  describe("list friends", () => {
    it("lists all accepted friends for a user", async () => {
      const repo = createInMemoryFriendRepository();
      repo.addUser("user-a", "a@test.com", "User A");
      repo.addUser("user-b", "b@test.com", "User B");
      repo.addUser("user-c", "c@test.com", "User C");

      const service = createFriendService({ repository: repo as unknown as FriendRepository });
      await service.sendFriendRequest({ requesterId: "user-a", addresseeId: "user-b" });
      await service.sendFriendRequest({ requesterId: "user-c", addresseeId: "user-a" });

      const req1 = await repo.friends.findFriend("user-a", "user-b");
      await service.acceptFriendRequest({ requestId: req1!.id, userId: "user-b" });

      const req2 = await repo.friends.findFriend("user-c", "user-a");
      await service.acceptFriendRequest({ requestId: req2!.id, userId: "user-a" });

      const friends = await service.listFriends({ userId: "user-a" });
      expect(friends).toHaveLength(2);
    });
  });
});
