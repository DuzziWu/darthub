import { PrismaClient, type Friend } from "@prisma/client";
import type { FriendRepository, FriendRow, FriendUnitOfWork, UserLookup } from "./repository";

const client = new PrismaClient();

function toFriendRow(f: Friend): FriendRow {
  return {
    id: f.id,
    requesterId: f.requesterId,
    addresseeId: f.addresseeId,
    status: f.status,
    createdAt: f.createdAt,
    respondedAt: f.respondedAt,
  };
}

const userStore: UserLookup = {
  findById: async (id: string) => {
    const user = await client.user.findUnique({ where: { id } });
    if (!user) return null;
    return { id: user.id, email: user.email, displayName: user.displayName };
  },
};

const friendStore = {
  findFriend: async (requesterId: string, addresseeId: string) => {
    const f = await client.friend.findUnique({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
    });
    return f ? toFriendRow(f) : null;
  },
  findFriendsByUser: async (userId: string) => {
    const rows = await client.friend.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: "ACCEPTED",
      },
    });
    return rows.map(toFriendRow);
  },
  findPendingForAddressee: async (addresseeId: string) => {
    const rows = await client.friend.findMany({
      where: { addresseeId, status: "PENDING" },
    });
    return rows.map(toFriendRow);
  },
  createFriend: async (requesterId: string, addresseeId: string) => {
    const f = await client.friend.create({
      data: { requesterId, addresseeId },
    });
    return toFriendRow(f);
  },
  updateStatus: async (id: string, status: "ACCEPTED" | "DECLINED") => {
    const f = await client.friend.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
    return toFriendRow(f);
  },
  deleteFriend: async (id: string) => {
    await client.friend.delete({ where: { id } });
  },
};

export function createPrismaFriendRepository(): FriendRepository {
  return {
    users: userStore,
    friends: friendStore,
    runInTransaction: async <T>(fn: (tx: FriendRepository) => Promise<T>) => {
      return client.$transaction(async (tx) => {
        const txRepo: FriendRepository = {
          users: {
            findById: async (id: string) => {
              const user = await tx.user.findUnique({ where: { id } });
              if (!user) return null;
              return { id: user.id, email: user.email, displayName: user.displayName };
            },
          },
          friends: {
            findFriend: async (requesterId: string, addresseeId: string) => {
              const f = await tx.friend.findUnique({
                where: { requesterId_addresseeId: { requesterId, addresseeId } },
              });
              return f ? toFriendRow(f) : null;
            },
            findFriendsByUser: async (userId: string) => {
              const rows = await tx.friend.findMany({
                where: {
                  OR: [{ requesterId: userId }, { addresseeId: userId }],
                  status: "ACCEPTED",
                },
              });
              return rows.map(toFriendRow);
            },
            findPendingForAddressee: async (addresseeId: string) => {
              const rows = await tx.friend.findMany({
                where: { addresseeId, status: "PENDING" },
              });
              return rows.map(toFriendRow);
            },
            createFriend: async (requesterId: string, addresseeId: string) => {
              const f = await tx.friend.create({ data: { requesterId, addresseeId } });
              return toFriendRow(f);
            },
            updateStatus: async (id: string, status: "ACCEPTED" | "DECLINED") => {
              const f = await tx.friend.update({
                where: { id },
                data: { status, respondedAt: new Date() },
              });
              return toFriendRow(f);
            },
            deleteFriend: async (id: string) => {
              await tx.friend.delete({ where: { id } });
            },
          },
          runInTransaction: async <T2>(fn: (tx: FriendUnitOfWork) => Promise<T2>) =>
            txRepo.runInTransaction(fn),
        };
        return fn(txRepo);
      });
    },
  };
}
