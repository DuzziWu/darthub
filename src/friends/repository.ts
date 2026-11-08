/** Row shapes for the friend system. */

export type FriendStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "BLOCKED";

export interface FriendRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface UserLookup {
  findById(id: string): Promise<{ id: string; email: string; displayName: string } | null>;
}

export interface FriendStore {
  findFriend(requesterId: string, addresseeId: string): Promise<FriendRow | null>;
  findFriendsByUser(userId: string): Promise<FriendRow[]>;
  findPendingForAddressee(addresseeId: string): Promise<FriendRow[]>;
  createFriend(requesterId: string, addresseeId: string): Promise<FriendRow>;
  updateStatus(id: string, status: "ACCEPTED" | "DECLINED"): Promise<FriendRow>;
  deleteFriend(id: string): Promise<void>;
}

export interface FriendUnitOfWork {
  users: UserLookup;
  friends: FriendStore;
}

export interface FriendRepository extends FriendUnitOfWork {
  runInTransaction<T>(fn: (tx: FriendUnitOfWork) => Promise<T>): Promise<T>;
}
