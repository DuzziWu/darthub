/**
 * Facade over both rating halves (Elo + Performance).
 *
 * `recordGameResult` applies, per game and per game mode:
 *  - one Elo update per player using the pure math in `./eloService`;
 *  - one performance recalculation per player from the repository's
 *    batched recent-game summary.
 *
 * Both ratings are stored in their own tables, keyed (userId, mode) —
 * an Elo row never doubles as a performance row.
 *
 * Guests: a guest identity holds ratings PROVISIONALLY IN MEMORY ONLY.
 * The repository is never asked to persist a guest row, so no elo_ratings
 * or performance_ratings rows exist for a guest until that guest is
 * migrated onto a registered user (at which point the ordinary user path
 * takes over and the Guest's optional `userId` link applies).
 */

import {
  DEFAULT_K_FACTOR,
  DEFAULT_RATING,
  MAX_RATING,
  MIN_RATING,
  computeEloChange,
} from "@/rating/eloService";
import { computePerformanceStats, DEFAULT_PERFORMANCE_WINDOW } from "@/rating/performanceService";
import type { RatingRepository } from "@/rating/ratingRepository";
import { DEFAULT_RATING_MODE } from "@/rating/ratingRepository";
import type { EloRatingRecord, PerformanceRatingRecord } from "@/rating/ratingRepository";

/** Either a registered user or a not-yet-migrated guest. */
export type RatingActor = { kind: "user"; userId: string } | { kind: "guest"; guestId: string };

const actorId = (actor: RatingActor): string =>
  actor.kind === "user" ? actor.userId : actor.guestId;

export interface RecordGameResultInput {
  /** The winning actor (the Elo side's "win"). */
  winner: RatingActor;
  /** The losing actor. */
  loser: RatingActor;
  /** Game mode the ratings belong to. */
  mode?: string;
  /** K-factor override for this game (defaults to the standard 32). */
  kFactor?: number;
}

export interface RatingProfileInput {
  actor: RatingActor;
  mode?: string;
}

export interface RatingProfile {
  elo: EloRatingRecord;
  performance: PerformanceRatingRecord;
}

export interface RatingRecordResult {
  winner: RatingProfile;
  loser: RatingProfile;
}

export interface RatingServiceDependencies {
  repository: RatingRepository;
  kFactor?: number;
  minRating?: number;
  maxRating?: number;
}

export interface RatingService {
  recordGameResult(input: RecordGameResultInput): Promise<RatingRecordResult>;
  getRatingProfile(input: RatingProfileInput): Promise<RatingProfile>;
  /**
   * One profile per (userId, mode) pair the user has rated rows for.
   * Two batched reads total (all Elo rows + all performance rows), never
   * a query per mode.
   */
  listRatingProfiles(userId: string): Promise<RatingProfile[]>;
}

const blankEloRecord = (userId: string, mode: string): EloRatingRecord => ({
  userId,
  mode,
  rating: DEFAULT_RATING,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
});

const blankPerformanceRecord = (userId: string, mode: string): PerformanceRatingRecord => ({
  userId,
  mode,
  averageTurnScore: 0,
  checkoutPct: 0,
  gamesPlayed: 0,
});

/** In-memory store for provisional (not-yet-migrated) guest ratings. */
class GuestProvisionalStore {
  private readonly profiles = new Map<string, RatingProfile>();

  get(guestId: string, mode: string): RatingProfile | undefined {
    return this.profiles.get(`${guestId}:${mode}`);
  }

  set(guestId: string, mode: string, profile: RatingProfile): void {
    this.profiles.set(`${guestId}:${mode}`, profile);
  }
}

export function createRatingService(dependencies: RatingServiceDependencies): RatingService {
  const {
    repository,
    kFactor = DEFAULT_K_FACTOR,
    minRating = MIN_RATING,
    maxRating = MAX_RATING,
  } = dependencies;
  const guests = new GuestProvisionalStore();

  const isGuest = (actor: RatingActor): boolean => actor.kind === "guest";

  const loadProfile = async (actor: RatingActor, mode: string): Promise<RatingProfile> => {
    const id = actorId(actor);
    const stored = isGuest(actor)
      ? guests.get(id, mode)
      : // Users: two single-selects (repository contract).
        {
          elo: (await repository.getEloRating(id, mode)) ?? blankEloRecord(id, mode),
          performance:
            (await repository.getPerformanceRating(id, mode)) ?? blankPerformanceRecord(id, mode),
        };
    if (stored !== undefined) {
      return stored;
    }
    return {
      elo: blankEloRecord(id, mode),
      performance: blankPerformanceRecord(id, mode),
    };
  };

  /** Persisting guest rows is forbidden; guests stay in the memory store. */
  const storeProfile = async (
    actor: RatingActor,
    mode: string,
    id: string,
    profile: RatingProfile,
  ): Promise<RatingProfile> => {
    if (isGuest(actor)) {
      guests.set(id, mode, profile);
      return profile;
    }
    // Two upserts (one per table), not one per row loop.
    const [elo, performance] = await Promise.all([
      repository.saveEloRating(profile.elo),
      repository.savePerformanceRating(profile.performance),
    ]);
    return { elo, performance };
  };

  const applyResult = async (
    winnerActor: RatingActor,
    loserActor: RatingActor,
    mode: string,
  ): Promise<[RatingProfile, RatingProfile]> => {
    const winnerId = actorId(winnerActor);
    const loserId = actorId(loserActor);
    // Both ratings load before either update: changes are computed against
    // the pre-game ratings (a simultaneous update, never a double dip).
    const [winnerBefore, loserBefore] = await Promise.all([
      loadProfile(winnerActor, mode),
      loadProfile(loserActor, mode),
    ]);
    const winnerChange = computeEloChange({
      rating: winnerBefore.elo.rating,
      opponentRating: loserBefore.elo.rating,
      result: "win",
      kFactor,
      minRating,
      maxRating,
    });
    const loserChange = computeEloChange({
      rating: loserBefore.elo.rating,
      opponentRating: winnerBefore.elo.rating,
      result: "loss",
      kFactor,
      minRating,
      maxRating,
    });

    const winnerProfile: RatingProfile = {
      elo: {
        ...winnerBefore.elo,
        rating: winnerChange.newRating,
        gamesPlayed: winnerBefore.elo.gamesPlayed + 1,
        wins: winnerBefore.elo.wins + 1,
      },
      performance: {
        ...winnerBefore.performance,
        // Aggregate all of the window's stats in a single query (repository
        // contract). Guests have no GameSession rows yet, so this stays 0.
        ...computePerformanceStats(
          await repository.getRecentGameStats(winnerId, mode, DEFAULT_PERFORMANCE_WINDOW),
        ),
      },
    };
    const loserProfile: RatingProfile = {
      elo: {
        ...loserBefore.elo,
        rating: loserChange.newRating,
        gamesPlayed: loserBefore.elo.gamesPlayed + 1,
        losses: loserBefore.elo.losses + 1,
      },
      performance: {
        ...loserBefore.performance,
        ...computePerformanceStats(
          await repository.getRecentGameStats(loserId, mode, DEFAULT_PERFORMANCE_WINDOW),
        ),
      },
    };

    return Promise.all([
      storeProfile(winnerActor, mode, winnerId, winnerProfile),
      storeProfile(loserActor, mode, loserId, loserProfile),
    ]) as Promise<[RatingProfile, RatingProfile]>;
  };

  return {
    async recordGameResult(input: RecordGameResultInput): Promise<RatingRecordResult> {
      const { winner, loser, mode = DEFAULT_RATING_MODE } = input;
      const [winnerProfile, loserProfile] = await applyResult(winner, loser, mode);
      return { winner: winnerProfile, loser: loserProfile };
    },

    async getRatingProfile(input: RatingProfileInput): Promise<RatingProfile> {
      const { actor, mode = DEFAULT_RATING_MODE } = input;
      return loadProfile(actor, mode);
    },

    async listRatingProfiles(userId: string): Promise<RatingProfile[]> {
      // Two batched reads for all modes; join in memory by mode key.
      const [eloRows, performanceRows] = await Promise.all([
        repository.getEloRatingsForUser(userId),
        repository.getPerformanceRatingsForUser(userId),
      ]);
      const profiles = new Map<string, RatingProfile>();
      for (const elo of eloRows) {
        profiles.set(elo.mode, {
          elo,
          performance: blankPerformanceRecord(userId, elo.mode),
        });
      }
      for (const performance of performanceRows) {
        const existing = profiles.get(performance.mode);
        if (existing === undefined) {
          profiles.set(performance.mode, {
            elo: blankEloRecord(userId, performance.mode),
            performance,
          });
        } else {
          existing.performance = performance;
        }
      }
      return [...profiles.values()];
    },
  };
}
