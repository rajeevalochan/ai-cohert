import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { LessonProgressStatus } from "~/db/schema";
import { createLessonViewer, flattenCourseLessons } from "../index.server";
import * as schema from "~/db/schema";
import { addCourse, addLesson, addModule, watch } from "./fixtures";

const { Completed, InProgress } = LessonProgressStatus;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let viewer: ReturnType<typeof createLessonViewer>;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  viewer = createLessonViewer(db);
  lessonId = addLesson(db, addModule(db, base.course.id, 1).id, 1).id;
});

/** Another course, with a lesson the Student has finished. */
function otherCourseWithProgress() {
  const other = addCourse(db, {
    slug: "other",
    instructorId: base.instructor.id,
    categoryId: base.category.id,
  });
  const lesson = addLesson(db, addModule(db, other.id, 1).id, 1);
  viewer.markLessonComplete(base.user.id, lesson.id);
  return other;
}

describe("the course and its lessons", () => {
  it("leaves out another course's lessons", () => {
    otherCourseWithProgress();

    const course = viewer.getCourseWithDetails(base.course.id);
    expect(course?.modules.flatMap((m) => m.lessons.map((l) => l.id))).toEqual([
      lessonId,
    ]);
  });

  it("returns the course with its instructor, category, and modules and lessons in order", () => {
    const second = addModule(db, base.course.id, 2);
    const later = addLesson(db, second.id, 2);
    const earlier = addLesson(db, second.id, 1);

    const course = viewer.getCourseWithDetails(base.course.id);

    expect(course).toMatchObject({
      id: base.course.id,
      instructorName: "Test Instructor",
      categoryName: "Programming",
    });
    expect(course?.modules.map((m) => m.position)).toEqual([1, 2]);
    expect(course?.modules[0].lessons.map((l) => l.id)).toEqual([lessonId]);
    expect(course?.modules[1].lessons.map((l) => l.id)).toEqual([
      earlier.id,
      later.id,
    ]);
  });

  it("returns null for an unknown course and no modules for an empty one", () => {
    expect(viewer.getCourseWithDetails(999)).toBeNull();
    const empty = createTestDb();
    const emptyBase = seedBaseData(empty);
    expect(
      createLessonViewer(empty).getCourseWithDetails(emptyBase.course.id)
        ?.modules
    ).toEqual([]);
  });

  it("finds the course a lesson belongs to", () => {
    expect(viewer.getCourseForLesson(lessonId)).toEqual({
      courseId: base.course.id,
      courseTitle: "Test Course",
      courseSlug: "test-course",
      instructorId: base.instructor.id,
    });
    expect(viewer.getLessonById(lessonId)?.title).toBe("Lesson 1");
    expect(viewer.getModuleById(999)).toBeUndefined();
    const lesson = viewer.getLessonById(lessonId);
    expect(viewer.getModuleById(lesson?.moduleId ?? -1)?.title).toBe(
      "Module 1"
    );
    expect(viewer.getUserById(base.user.id)?.name).toBe("Test User");
  });

  it("flattens modules into one list of lessons in course order", () => {
    expect(
      flattenCourseLessons({
        modules: [
          {
            id: 1,
            title: "A",
            lessons: [{ id: 10, title: "a1", moduleId: 1 }],
          },
          {
            id: 2,
            title: "B",
            lessons: [{ id: 20, title: "b1", moduleId: 2 }],
          },
        ],
      })
    ).toEqual([
      { id: 10, title: "a1", moduleId: 1, moduleTitle: "A" },
      { id: 20, title: "b1", moduleId: 2, moduleTitle: "B" },
    ]);
  });
});

describe("lesson progress", () => {
  it("starts a lesson in progress, then completes it", () => {
    expect(viewer.markLessonInProgress(base.user.id, lessonId).status).toBe(
      InProgress
    );
    const done = viewer.markLessonComplete(base.user.id, lessonId);

    expect(done).toMatchObject({ status: Completed });
    expect(done.completedAt).not.toBeNull();
    expect(
      viewer.getLessonProgressForCourse(base.user.id, base.course.id)
    ).toEqual([done]);
  });

  it("completes a lesson that was never started", () => {
    expect(viewer.markLessonComplete(base.user.id, lessonId)).toMatchObject({
      status: Completed,
    });
  });

  it("does not move a completed lesson back to in progress", () => {
    viewer.markLessonComplete(base.user.id, lessonId);

    expect(viewer.markLessonInProgress(base.user.id, lessonId).status).toBe(
      Completed
    );
  });

  it("lists only this Student's progress on this course", () => {
    viewer.markLessonComplete(base.instructor.id, lessonId);
    const other = otherCourseWithProgress();
    expect(
      viewer.getLessonProgressForCourse(base.user.id, other.id)
    ).toHaveLength(1);

    expect(
      viewer.getLessonProgressForCourse(base.user.id, base.course.id)
    ).toEqual([]);
    expect(viewer.getLessonProgressForCourse(base.user.id, 999)).toEqual([]);
  });

  it("lists nothing for a course with no lessons, even with progress elsewhere", () => {
    viewer.markLessonComplete(base.user.id, lessonId);
    const bare = otherCourseWithProgress();
    const empty = addCourse(db, {
      slug: "empty",
      instructorId: base.instructor.id,
      categoryId: base.category.id,
    });

    expect(viewer.getLessonProgressForCourse(base.user.id, empty.id)).toEqual(
      []
    );
    addModule(db, empty.id, 1);
    expect(viewer.getLessonProgressForCourse(base.user.id, empty.id)).toEqual(
      []
    );
    expect(
      viewer.getLessonProgressForCourse(base.user.id, bare.id)
    ).toHaveLength(1);
  });

  it("moves a not-started lesson to in progress", () => {
    db.insert(schema.lessonProgress)
      .values({
        userId: base.user.id,
        lessonId,
        status: LessonProgressStatus.NotStarted,
      })
      .run();

    expect(viewer.markLessonInProgress(base.user.id, lessonId).status).toBe(
      InProgress
    );
  });
});

describe("watching the video", () => {
  const at = (seconds: number, minute: number) => ({
    userId: base.user.id,
    lessonId,
    at: seconds,
    createdAt: `2026-10-06T12:0${minute}:00.000Z`,
  });

  it("resumes from the most recent position, not the furthest", () => {
    watch(db, at(300, 1));
    watch(db, at(120, 2));

    expect(viewer.getLastWatchPosition(base.user.id, lessonId)).toBe(120);
  });

  it("starts from zero with nothing watched", () => {
    expect(viewer.getLastWatchPosition(base.user.id, lessonId)).toBe(0);
    expect(viewer.calculateWatchProgress(base.user.id, lessonId, 600)).toBe(0);
  });

  it("measures progress by the furthest position, rounded, capped at 100", () => {
    watch(db, at(200, 1));
    watch(db, at(100, 2));
    expect(viewer.calculateWatchProgress(base.user.id, lessonId, 600)).toBe(33);

    watch(db, at(900, 3));
    expect(viewer.calculateWatchProgress(base.user.id, lessonId, 600)).toBe(
      100
    );
  });

  it("ignores other people's watching and a video with no duration", () => {
    watch(db, { ...at(300, 1), userId: base.instructor.id });

    expect(viewer.calculateWatchProgress(base.user.id, lessonId, 600)).toBe(0);
    watch(db, at(300, 2));
    expect(viewer.calculateWatchProgress(base.user.id, lessonId, 0)).toBe(0);
  });
});
