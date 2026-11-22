import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { noteDraft, type NoteDraft } from "~/modules/lesson-notes";
import { cn, formatRelativeTime } from "~/lib/utils";

type SavedNote = { body: string; updatedAt: string };

// Laid out like the Questions & Discussion card further down the lesson, so
// the two read as one set of tools for the Student.
export function LessonNote({ note }: { note: SavedNote | null }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const draft = noteDraft(body);
  const unchanged = note !== null && body.trim() === note.body;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <LessonNoteHeader />
        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="min-h-28 resize-y"
          />
          <LessonNoteFooter
            note={note}
            draft={draft}
            isSaving={isSaving}
            canSubmit={!isSaving && draft.canSave && !unchanged}
            error={fetcher.data?.error}
          />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your Notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function LessonNoteFooter({
  note,
  draft,
  isSaving,
  canSubmit,
  error,
}: {
  note: SavedNote | null;
  draft: NoteDraft;
  isSaving: boolean;
  canSubmit: boolean;
  error: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={!canSubmit}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>
      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : (
        note && (
          <span
            suppressHydrationWarning
            className="text-xs text-muted-foreground"
          >
            Last edited {formatRelativeTime(note.updatedAt)}
          </span>
        )
      )}
      <span
        className={cn(
          "ml-auto text-xs",
          draft.tooLong ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {draft.length} / {draft.max}
      </span>
    </div>
  );
}
