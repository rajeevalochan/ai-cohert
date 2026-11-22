import { describe, it, expect } from "vitest";
import { noteDraft } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

describe("noteDraft", () => {
  it("cannot save an empty draft", () => {
    expect(noteDraft("")).toEqual({
      length: 0,
      max: MAX_NOTE_LENGTH,
      empty: true,
      tooLong: false,
      canSave: false,
    });
  });

  it("treats a draft of only whitespace as empty", () => {
    const draft = noteDraft("   \n\t ");
    expect(draft.empty).toBe(true);
    expect(draft.length).toBe(0);
    expect(draft.canSave).toBe(false);
  });

  it("counts the trimmed text, as the server does", () => {
    const draft = noteDraft("  Generics  ");
    expect(draft.length).toBe(8);
    expect(draft.empty).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("can save a draft exactly at the limit", () => {
    const draft = noteDraft("a".repeat(MAX_NOTE_LENGTH));
    expect(draft.length).toBe(MAX_NOTE_LENGTH);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("cannot save a draft one character over the limit", () => {
    const draft = noteDraft("a".repeat(MAX_NOTE_LENGTH + 1));
    expect(draft.tooLong).toBe(true);
    expect(draft.canSave).toBe(false);
  });
});
