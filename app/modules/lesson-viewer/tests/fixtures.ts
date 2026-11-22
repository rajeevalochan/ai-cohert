import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { markdown } from "~/lib/text";
import type { TestDb } from "~/test/setup";

// The module has no writers for course structure, quizzes, watch events or
// comments (those belong to other pages), so fixtures insert rows directly.

export function addModule(db: TestDb, courseId: number, position: number) {
  return db
    .insert(schema.modules)
    .values({ courseId, title: `Module ${position}`, position })
    .returning()
    .get();
}

export function addLesson(db: TestDb, moduleId: number, position: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title: `Lesson ${position}`, position })
    .returning()
    .get();
}

type QuestionSpec = { type: QuestionType; options: boolean[] };

/** A quiz whose questions each have options; `true` marks the correct one. */
export function addQuiz(
  db: TestDb,
  lessonId: number,
  questions: QuestionSpec[]
) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const optionIds = questions.map((spec, index) => {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Question ${index + 1}`,
        questionType: spec.type,
        position: index + 1,
      })
      .returning()
      .get();
    return {
      questionId: question.id,
      options: spec.options.map(
        (isCorrect, n) =>
          db
            .insert(schema.quizOptions)
            .values({
              questionId: question.id,
              optionText: `Option ${n + 1}`,
              isCorrect,
            })
            .returning()
            .get().id
      ),
    };
  });
  return { quiz, questions: optionIds };
}

export function watch(
  db: TestDb,
  event: { userId: number; lessonId: number; at: number; createdAt: string }
) {
  db.insert(schema.videoWatchEvents)
    .values({
      userId: event.userId,
      lessonId: event.lessonId,
      eventType: "progress",
      positionSeconds: event.at,
      createdAt: event.createdAt,
    })
    .run();
}

export function addComment(
  db: TestDb,
  comment: {
    lessonId: number;
    userId: number;
    body: string;
    parentId?: number;
    deleted?: boolean;
    createdAt: string;
  }
) {
  return db
    .insert(schema.comments)
    .values({
      lessonId: comment.lessonId,
      userId: comment.userId,
      parentId: comment.parentId ?? null,
      body: markdown(comment.body),
      createdAt: comment.createdAt,
      deletedAt: comment.deleted ? comment.createdAt : null,
    })
    .returning()
    .get();
}

export function addCourse(
  db: TestDb,
  course: { slug: string; instructorId: number; categoryId: number }
) {
  return db
    .insert(schema.courses)
    .values({
      ...course,
      title: course.slug,
      description: course.slug,
      salesCopy: markdown(course.slug),
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}
