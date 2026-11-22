import { describe, it, expect } from "vitest";
import { lessonSections, type LessonPageFacts } from "../index";

const enrolledStudent: LessonPageFacts = {
  hasVideo: true,
  hasContent: true,
  signedIn: true,
  enrolled: true,
  hasQuiz: true,
};

describe("lessonSections", () => {
  it("puts the Note after the video and the lesson text, before the quiz", () => {
    expect(lessonSections(enrolledStudent)).toEqual([
      "video",
      "content",
      "note",
      "quiz",
      "complete",
      "discussion",
    ]);
  });

  it("keeps the Note after the text when the lesson has no video", () => {
    expect(lessonSections({ ...enrolledStudent, hasVideo: false })).toEqual([
      "content",
      "note",
      "quiz",
      "complete",
      "discussion",
    ]);
  });

  it("keeps the Note after the video when the lesson has no text", () => {
    expect(lessonSections({ ...enrolledStudent, hasContent: false })).toEqual([
      "video",
      "note",
      "quiz",
      "complete",
      "discussion",
    ]);
  });

  it("shows the empty state, then the Note, when the lesson has nothing yet", () => {
    expect(
      lessonSections({ ...enrolledStudent, hasVideo: false, hasContent: false })
    ).toEqual(["empty", "note", "quiz", "complete", "discussion"]);
  });

  it("shows no Note, quiz or completion to a visitor who is not signed in", () => {
    expect(
      lessonSections({ ...enrolledStudent, signedIn: false, enrolled: false })
    ).toEqual(["video", "content", "discussion"]);
  });

  it("shows the Note but no quiz or completion to a signed-in learner who is not enrolled", () => {
    expect(lessonSections({ ...enrolledStudent, enrolled: false })).toEqual([
      "video",
      "content",
      "note",
      "discussion",
    ]);
  });

  it("leaves out the quiz when the lesson has none", () => {
    expect(lessonSections({ ...enrolledStudent, hasQuiz: false })).toEqual([
      "video",
      "content",
      "note",
      "complete",
      "discussion",
    ]);
  });

  it("needs both sign-in and enrollment for the quiz and completion", () => {
    expect(
      lessonSections({ ...enrolledStudent, signedIn: false, enrolled: true })
    ).toEqual(["video", "content", "discussion"]);
  });
});
