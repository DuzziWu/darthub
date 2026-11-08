import type { FriendRepository, FriendRow } from "./repository";

export interface SendFriendRequestInput {
  requesterId: string;
  addresseeId: string;
}

export interface AcceptFriendRequestInput {
  requestId: string;
  userId: string;
}

export interface ListFriendsInput {
  userId: string;
}

export interface FriendServiceDeps {
  repository: FriendRepository;
}

export interface DeclineFriendRequestInput {
  requestId: string;
  userId: string;
}

export interface FriendService {
  sendFriendRequest(input: SendFriendRequestInput): Promise<FriendRow>;
  acceptFriendRequest(input: AcceptFriendRequestInput): Promise<FriendRow>;
  declineFriendRequest(input: DeclineFriendRequestInput): Promise<FriendRow>;
  listFriends(input: ListFriendsInput): Promise<FriendRow[]>;
}

export function createFriendService(deps: FriendServiceDeps): FriendService {
  const { repository } = deps;

  return {
    async sendFriendRequest(input: SendFriendRequestInput): Promise<FriendRow> {
      const { requesterId, addresseeId } = input;

      if (requesterId === addresseeId) {
        throw new Error("Cannot send friend request to yourself");
      }

      const [requester, addressee] = await Promise.all([
        repository.users.findById(requesterId),
        repository.users.findById(addresseeId),
      ]);

      if (!requester || !addressee) {
        throw new Error("User not found");
      }

      const existing = await repository.friends.findFriend(requesterId, addresseeId);
      if (existing) {
        throw new Error("Friend request already exists");
      }

      return repository.friends.createFriend(requesterId, addresseeId);
    },

    async acceptFriendRequest(input: AcceptFriendRequestInput): Promise<FriendRow> {
      const { requestId, userId } = input;

      const pending = await repository.friends.findPendingForAddressee(userId);
      const request = pending.find((p) => p.id === requestId);
      if (!request) {
        throw new Error("Friend request not found");
      }

      return repository.friends.updateStatus(requestId, "ACCEPTED");
    },

    async declineFriendRequest(input: DeclineFriendRequestInput): Promise<FriendRow> {
      const { requestId, userId } = input;

      const pending = await repository.friends.findPendingForAddressee(userId);
      const request = pending.find((p) => p.id === requestId);
      if (!request) {
        throw new Error("Friend request not found");
      }

      return repository.friends.updateStatus(requestId, "DECLINED");
    },

    async listFriends(input: ListFriendsInput): Promise<FriendRow[]> {
      const { userId } = input;
      return repository.friends.findFriendsByUser(userId);
    },
  };
}
