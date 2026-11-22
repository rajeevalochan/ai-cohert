import {
  orderLessonSections,
  type LessonPageFacts,
  type LessonSection,
} from "./lib/sections";

export type { LessonPageFacts, LessonSection };

/** The sections of a Lesson page, top to bottom, for what the page holds. */
export function lessonSections(facts: LessonPageFacts): LessonSection[] {
  return orderLessonSections(facts);
}
