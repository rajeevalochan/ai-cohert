export type LessonSection =
  | "video"
  | "content"
  | "empty"
  | "note"
  | "quiz"
  | "complete"
  | "discussion";

export type LessonPageFacts = {
  hasVideo: boolean;
  hasContent: boolean;
  signedIn: boolean;
  enrolled: boolean;
  hasQuiz: boolean;
};

// The Note comes after the Lesson's own material, not between the video and
// its text: splitting the two left the written lesson stranded below a form.
export function orderLessonSections(facts: LessonPageFacts): LessonSection[] {
  const { hasVideo, hasContent, signedIn, enrolled, hasQuiz } = facts;
  const learning = enrolled && signedIn;
  const sections: Array<LessonSection | false> = [
    hasVideo && "video",
    hasContent && "content",
    !hasVideo && !hasContent && "empty",
    signedIn && "note",
    hasQuiz && learning && "quiz",
    learning && "complete",
    "discussion",
  ];
  return sections.filter((s): s is LessonSection => s !== false);
}
