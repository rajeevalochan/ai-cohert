import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { createLessonViewer } from "../index.server";
import { addLesson, addModule, addQuiz } from "./fixtures";

const MC = QuestionType.MultipleChoice;
const TF = QuestionType.TrueFalse;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let viewer: ReturnType<typeof createLessonViewer>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  lessonId = addLesson(db, addModule(db, base.course.id, 1).id, 1).id;
  viewer = createLessonViewer(db);
});

/** A quiz of `total` questions, answered right `right` times. */
function answer(total: number, right: number) {
  const { quiz, questions } = addQuiz(
    db,
    lessonId,
    Array.from({ length: total }, () => ({ type: MC, options: [false, true] }))
  );
  const picks = Object.fromEntries(
    questions.map((q, i) => [q.questionId, q.options[i < right ? 1 : 0]])
  );
  return viewer.computeResult(base.user.id, quiz.id, picks);
}

describe("grading a quiz", () => {
  it.each([
    [10, "A", true],
    [9, "A", true],
    [8, "B", true],
    [7, "C", false],
    [6, "D", false],
    [5, "F", false],
  ])("%i of 10 right is a %s, passed: %s", (right, grade, passed) => {
    expect(answer(10, right)).toMatchObject({
      score: right / 10,
      grade,
      passed,
      totalCorrect: right,
      totalQuestions: 10,
    });
  });

  it("marks multiple-choice and true/false questions against the correct option", () => {
    const { quiz, questions } = addQuiz(db, lessonId, [
      { type: MC, options: [false, true, false] },
      { type: TF, options: [true, false] },
    ]);
    const [mc, tf] = questions;
    const result = viewer.computeResult(base.user.id, quiz.id, {
      [mc.questionId]: mc.options[1],
      [tf.questionId]: tf.options[1],
    });

    expect(result?.questionResults).toEqual([
      {
        questionId: mc.questionId,
        correct: true,
        selectedOptionId: mc.options[1],
        correctOptionId: mc.options[1],
      },
      {
        questionId: tf.questionId,
        correct: false,
        selectedOptionId: tf.options[1],
        correctOptionId: tf.options[0],
      },
    ]);
  });

  it("counts an unanswered question as wrong and does not store an answer for it", () => {
    const { quiz, questions } = addQuiz(db, lessonId, [
      { type: MC, options: [true, false] },
      { type: MC, options: [true, false] },
    ]);
    const [first, second] = questions;
    const result = viewer.computeResult(base.user.id, quiz.id, {
      [first.questionId]: first.options[0],
    });

    expect(result).toMatchObject({ score: 0.5, totalCorrect: 1 });
    expect(result?.questionResults[1]).toEqual({
      questionId: second.questionId,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    });
    const answers = db
      .select()
      .from(schema.quizAnswers)
      .where(eq(schema.quizAnswers.attemptId, result?.attemptId ?? -1))
      .all();
    expect(answers).toEqual([
      expect.objectContaining({
        questionId: first.questionId,
        selectedOptionId: first.options[0],
      }),
    ]);
  });

  it("saves the attempt so it becomes the best attempt", () => {
    const result = answer(2, 1);

    const quizId = viewer.getQuizByLessonId(lessonId)?.id ?? -1;
    expect(viewer.getBestAttempt(base.user.id, quizId)).toMatchObject({
      id: result?.attemptId,
      score: 0.5,
      passed: false,
    });
  });

  it("scores a quiz with no questions as zero", () => {
    const { quiz } = addQuiz(db, lessonId, []);

    expect(viewer.computeResult(base.user.id, quiz.id, {})).toMatchObject({
      score: 0,
      grade: "F",
      passed: false,
      totalQuestions: 0,
    });
  });

  it("returns null for a quiz that does not exist", () => {
    expect(viewer.computeResult(base.user.id, 999, {})).toBeNull();
  });
});

describe("reading a quiz", () => {
  it("finds the best of several attempts", () => {
    const { quiz, questions } = addQuiz(db, lessonId, [
      { type: MC, options: [true, false] },
      { type: MC, options: [true, false] },
    ]);
    const [a, b] = questions;
    viewer.computeResult(base.user.id, quiz.id, {
      [a.questionId]: a.options[0],
    });
    viewer.computeResult(base.user.id, quiz.id, {
      [a.questionId]: a.options[0],
      [b.questionId]: b.options[0],
    });
    viewer.computeResult(base.user.id, quiz.id, {});

    expect(viewer.getBestAttempt(base.user.id, quiz.id)?.score).toBe(1);
    expect(viewer.getBestAttempt(base.instructor.id, quiz.id)).toBeUndefined();
  });

  it("returns the lesson's quiz with its questions in order and their options", () => {
    const { quiz, questions } = addQuiz(db, lessonId, [
      { type: MC, options: [true, false] },
      { type: TF, options: [false, true] },
    ]);

    expect(viewer.getQuizByLessonId(lessonId)?.id).toBe(quiz.id);
    const loaded = viewer.getQuizWithQuestions(quiz.id);
    expect(loaded?.questions.map((q) => q.id)).toEqual(
      questions.map((q) => q.questionId)
    );
    expect(loaded?.questions[1].options.map((o) => o.id)).toEqual(
      questions[1].options
    );
  });

  it("returns nothing for a lesson without a quiz or an unknown quiz", () => {
    expect(viewer.getQuizByLessonId(lessonId)).toBeUndefined();
    expect(viewer.getQuizWithQuestions(999)).toBeNull();
  });
});
