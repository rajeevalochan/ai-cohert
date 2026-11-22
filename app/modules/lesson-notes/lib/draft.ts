import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  max: number;
  empty: boolean;
  tooLong: boolean;
  canSave: boolean;
};

// The server trims before it checks the limit, so the counter counts the
// same characters the server will.
export function describeDraft(body: string): NoteDraft {
  const length = body.trim().length;
  const empty = length === 0;
  const tooLong = length > MAX_NOTE_LENGTH;
  return {
    length,
    max: MAX_NOTE_LENGTH,
    empty,
    tooLong,
    canSave: !empty && !tooLong,
  };
}
