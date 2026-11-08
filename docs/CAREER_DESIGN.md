# Career Mode Design Document

## Overview

Career Mode in DartHub is a single-player progression system where players rise from amateur pub darts player to world champion through a structured narrative arc, training sessions, and competitive matches against AI opponents.

## Narrative Arc

The career unfolds across five acts:

1. **Act I: Local Hero** — Player starts in a small-town darts league, learning fundamentals
2. **Act II: Rising Contender** — Player enters regional tournaments, facing stronger rivals
3. **Act III: National Stage** — Player competes in national circuits, earning sponsorship
4. **Act IV: World Series** — Player faces international champions on the world stage
5. **Act V: Legacy** — Player defends their title and mentors the next generation

## NPC Archetypes

### **NPC Archetype 1: Coach — "The Veteran"**

A retired professional darts player who serves as the player's mentor throughout their career. Speaks with a dry wit and uses sports metaphors.

- **Dialogue snippet**: "Your aim's as crooked as a politician's promises, but we've got time to fix that."
- **Role**: Provides training lessons, tips, and encouragement
- **Progression path**: Coach's involvement decreases as player advances, from hands-on coaching in Act I to occasional appearances in Act V

### **NPC Archetype 2: Rival — "The Prodigy"**

A young, naturally talented player who views the player as an obstacle to their rise. Cocky and dismissive.

- **Dialogue snippet**: "Another week, another pub. You really think you can compete with the big leagues?"
- **Role**: Primary antagonist in early acts; eventual ally in later acts after player proves themselves
- **Progression path**: Starts as antagonist (Act I-II), becomes grudging respect (Act III), eventual friend/rival (Acts IV-V)

### **NPC Archetype 3: Patron — "The Sponsor"**

A business figure who offers sponsorship deals and opportunities in exchange for visibility. Pragmatic but fair.

- **Dialogue snippet**: "You've got potential. But potential doesn't pay the bills. Win games, and I'll put my name behind you."
- **Role**: Unlocks equipment upgrades, tournament entries, and cosmetic rewards
- **Progression path**: Offers small deals in Act II, major sponsorship in Act III, lifetime partnership in Act V

## Training Lessons

### **Training Lesson 1: Aiming Fundamentals**

A lesson focusing on improving dart throw accuracy and consistency.

- **Skill taught**: aim
- **Objective**: Hit the target area 7 out of 10 throws
- **Target metric**: 70% accuracy on indicated target zones
- **Quest reference**: quest-aim-fundamentals (Stage 1 of quest-first-checkout)

### **Training Lesson 2: Checkout Techniques**

A lesson teaching players how to close out legs efficiently using mathematical optimal finishes.

- **Skill taught**: checkout
- **Objective**: Complete a 101 checkout using 3 darts or fewer
- **Target metric**: 80% successful checkout rate on 101 targets
- **Quest reference**: quest-checkout-mastery (Stage 2 of quest-first-checkout)

### **Training Lesson 3: Double-Out Mastery**

A lesson dedicated to the double-ring scoring mechanic required to win legs.

- **Skill taught**: double-out
- **Objective**: Hit at least 4 double-segment hits in a row
- **Target metric**: 60% double-segment accuracy over 20 throws
- **Quest reference**: quest-double-out-pro (Stage 3 of quest-first-checkout)

## Story Milestones and Quest IDs

| Milestone                     | Quest ID                 | Reward Tier                                           |
| ----------------------------- | ------------------------ | ----------------------------------------------------- |
| Complete local league         | quest-local-champion     | Tier 1: 100 XP, 50 coins, basic dart set              |
| Defeat The Prodigy first time | quest-rival-showdown     | Tier 2: 250 XP, 100 coins, reinforced barrel          |
| Qualify for nationals         | quest-national-qualifier | Tier 3: 500 XP, 200 coins, custom flights             |
| Win national championship     | quest-national-champion  | Tier 4: 1000 XP, 500 coins, sponsored apparel         |
| Reach world series            | quest-world-series-entry | Tier 5: 2000 XP, 1000 coins, tournament entry         |
| Become world champion         | quest-world-champion     | Tier 6: 5000 XP, 2500 coins, championship trophy skin |

## Reward System

### XP (Experience Points)

- Awarded for completing quests, winning matches, and achieving objectives
- Used to unlock new quests and progress through the storyline
- XP thresholds unlock new player levels (Level 1-50)

### Coins

- Earned through match wins, quest completion, and daily challenges
- Used to purchase cosmetic items, dart skins, and arena upgrades

### Unlockables

- **Equipment**: Dart barrels, flights, stems, and boards
- **Cosmetics**: Player avatars, arena decorations, trophy displays
- **Gameplay**: New game modes, difficulty levels, and AI opponent personas

### Reward Tiers

- **Tier 1 (Beginner)**: Basic equipment, 50-100 XP, 25-50 coins
- **Tier 2 (Intermediate)**: Improved equipment, 150-300 XP, 75-150 coins
- **Tier 3 (Advanced)**: Premium equipment, 400-700 XP, 200-400 coins
- **Tier 4 (Expert)**: Elite equipment, 800-1500 XP, 500-1000 coins
- **Tier 5 (Master)**: Championship-tier equipment, 2000-4000 XP, 1500-2500 coins
- **Tier 6 (Legend)**: Exclusive items, 5000+ XP, 3000+ coins

## Integration with Quest System

Career Mode milestones reference the JSON quest schema defined in Task 020. Each quest in `src/career/quests/` corresponds to a narrative milestone. The adaptive difficulty system (QuestAdaptiveDifficulty) adjusts objective targets based on player performance, ensuring engagement without frustration.
