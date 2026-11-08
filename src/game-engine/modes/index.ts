/**
 * Game mode implementations of the {@link DartGameMode} seam.
 *
 * Lives in its own barrel so concurrent feature work on `src/game-engine`
 * does not collide on the root `src/game-engine/index.ts` barrel.
 */
export { StandardMode, Standard501Mode, Standard301Mode } from "@/game-engine/modes/StandardMode";
export type { StandardModeConfig } from "@/game-engine/modes/StandardMode";
