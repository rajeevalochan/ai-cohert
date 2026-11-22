import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the notes form shows about the text a Student is typing: how long it
 * is against the limit, and whether Save can send it.
 */
export function noteDraft(body: string): NoteDraft {
  return describeDraft(body);
}
