import { loadLessonPage } from "./lib/load-page";
import { getCommentById } from "./lib/thread";
import { submitLessonQuiz } from "./lib/quiz";
import { markLessonComplete } from "./lib/progress";

export { loadLessonPage, markLessonComplete, submitLessonQuiz };

export type LessonPage = NonNullable<
  Awaited<ReturnType<typeof loadLessonPage>>
>;
export type LockedLessonPage = Extract<LessonPage, { view: "locked" }>;
export type FullLessonPage = Extract<LessonPage, { view: "full" }>;

/** Whether the comment exists and belongs to this lesson. */
export function isCommentOnLesson(commentId: number, lessonId: number) {
  const existing = getCommentById(commentId);
  return existing !== undefined && existing.lessonId === lessonId;
}
