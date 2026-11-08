import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * These tests verify the Career Design document (docs/CAREER_DESIGN.md)
 * contains the required content outlined in Task 041.
 */

const CAREER_DESIGN_PATH = path.resolve(process.cwd(), "docs", "CAREER_DESIGN.md");

function getCareerDesignContent(): string {
  if (!fs.existsSync(CAREER_DESIGN_PATH)) {
    throw new Error(`Career design document not found at ${CAREER_DESIGN_PATH}`);
  }
  return fs.readFileSync(CAREER_DESIGN_PATH, "utf-8");
}

describe("careerDesign", () => {
  it("outlines at least three distinct NPC archetypes with progression paths", () => {
    const content = getCareerDesignContent();

    // Count NPC archetype sections (## NPC Archetype or similar headers)
    const archetypeMatches = content.match(/#{1,3}\s+\*\*.*(?:Archetype|NPC).*\*\*/gi);
    const archetypeCount = archetypeMatches ? archetypeMatches.length : 0;

    expect(archetypeCount).toBeGreaterThanOrEqual(3);

    // Verify each archetype has a progression path section
    const progressionPathSections = content.match(/(?:progression|advancement|growth)\s+path/gi);
    expect(progressionPathSections).not.toBeNull();
    expect(progressionPathSections!.length).toBeGreaterThanOrEqual(3);
  });

  it("defines three core training lessons with measurable objectives", () => {
    const content = getCareerDesignContent();

    // Look for training lesson sections
    const lessonMatches = content.match(/#{1,3}\s+\*\*.*(?:Training Lesson|Lesson).*\*\*/gi);
    const lessonCount = lessonMatches ? lessonMatches.length : 0;

    expect(lessonCount).toBeGreaterThanOrEqual(3);

    // Verify measurable objectives are defined (targets, metrics)
    const hasObjectives = content.match(/(?:target|objective|goal).*\d+/gi);
    expect(hasObjectives).not.toBeNull();
    expect(hasObjectives!.length).toBeGreaterThanOrEqual(3);

    // Verify skills mentioned are dart-specific
    const dartSkills = content.match(/(?:aim|checkout|double-out|bullseye|score|throw)/gi);
    expect(dartSkills).not.toBeNull();
    expect(dartSkills!.length).toBeGreaterThanOrEqual(6);
  });

  it("maps story milestones to quest IDs and reward tiers", () => {
    const content = getCareerDesignContent();

    // Verify quest IDs are referenced
    const questIdMatches = content.match(/quest-[a-z0-9-]+/gi);
    expect(questIdMatches).not.toBeNull();
    expect(questIdMatches!.length).toBeGreaterThanOrEqual(3);

    // Verify reward tiers are defined
    const rewardTiers = content.match(/(?:tier|level)\s+[0-9]|XP|coins|unlockable/gi);
    expect(rewardTiers).not.toBeNull();
    expect(rewardTiers!.length).toBeGreaterThanOrEqual(3);

    // Verify milestone mapping exists (milestone -> quest relationship)
    const milestoneQuestMapping = content.match(/(?:milestone|story).*(?:quest|objective)/gi);
    expect(milestoneQuestMapping).not.toBeNull();
  });
});
