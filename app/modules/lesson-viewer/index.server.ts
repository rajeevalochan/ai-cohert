import { db as appDb } from "~/db";
import { createCourseQueries } from "./lib/course";
import { createQuizQueries } from "./lib/quiz";
import { createThreadQueries } from "./lib/thread";
import type { Db } from "./lib/db";

export type { Db } from "./lib/db";
export type { ThreadComment } from "./lib/thread";
export { renderThread } from "./lib/thread";
export { flattenCourseLessons, type FlatLesson } from "./lib/flatten";

/**
 * What the Lesson page reads and writes, bound to a database. The route uses
 * `lessonViewer`, which reads the app database; tests build their own against
 * a test database.
 */
export function createLessonViewer(database: Db) {
  return {
    ...createCourseQueries(database),
    ...createThreadQueries(database),
    ...createQuizQueries(database),
  };
}

export const lessonViewer = createLessonViewer(appDb);
