import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import {
  createLessonViewer,
  renderThread,
  type ThreadComment,
} from "../index.server";
import { addComment, addLesson, addModule } from "./fixtures";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let viewer: ReturnType<typeof createLessonViewer>;
let lessonId: number;

const minute = (n: number) => `2026-10-06T12:0${n}:00.000Z`;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  viewer = createLessonViewer(db);
  lessonId = addLesson(db, addModule(db, base.course.id, 1).id, 1).id;
});

type Post = { body: string; at: number; parentId?: number; deleted?: boolean };

function post(userId: number, { at, ...rest }: Post) {
  return addComment(db, { lessonId, userId, createdAt: minute(at), ...rest });
}

describe("the lesson's discussion", () => {
  it("nests replies under their question, oldest first, and marks the instructor", () => {
    const second = post(base.user.id, { body: "Second", at: 2 });
    const first = post(base.user.id, { body: "First", at: 1 });
    post(base.instructor.id, { body: "Answer", at: 3, parentId: first.id });

    const thread = viewer.getLessonThread(lessonId);

    expect(thread.map((c) => c.id)).toEqual([first.id, second.id]);
    expect(thread[0]).toMatchObject({
      body: "First",
      deleted: false,
      author: { id: base.user.id, isInstructor: false, isPlatformAdmin: false },
    });
    expect(thread[0].replies).toEqual([
      expect.objectContaining({
        body: "Answer",
        author: expect.objectContaining({ isInstructor: true }),
        replies: [],
      }),
    ]);
    expect(thread[1].replies).toEqual([]);
  });

  it("marks a Platform Admin", () => {
    const admin = db
      .insert(schema.users)
      .values({ name: "Ada", email: "ada@example.com", role: UserRole.Admin })
      .returning()
      .get();
    post(admin.id, { body: "Hello", at: 1 });

    expect(viewer.getLessonThread(lessonId)[0].author.isPlatformAdmin).toBe(
      true
    );
  });

  it("keeps a deleted question with replies, blanked, and drops one without", () => {
    const kept = post(base.user.id, { body: "Secret", at: 1, deleted: true });
    post(base.instructor.id, { body: "Reply", at: 2, parentId: kept.id });
    post(base.user.id, { body: "Gone", at: 3, deleted: true });

    const thread = viewer.getLessonThread(lessonId);

    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({
      id: kept.id,
      body: "",
      deleted: true,
      editedAt: null,
    });
  });

  it("drops deleted replies", () => {
    const question = post(base.user.id, { body: "Q", at: 1 });
    post(base.instructor.id, {
      body: "Oops",
      at: 2,
      parentId: question.id,
      deleted: true,
    });

    expect(viewer.getLessonThread(lessonId)[0].replies).toEqual([]);
  });

  it("ignores a reply whose parent is itself a reply", () => {
    const question = post(base.user.id, { body: "Q", at: 1 });
    const reply = post(base.instructor.id, {
      body: "A",
      at: 2,
      parentId: question.id,
    });
    post(base.user.id, { body: "Too deep", at: 3, parentId: reply.id });

    expect(
      viewer.getLessonThread(lessonId)[0].replies.map((r) => r.id)
    ).toEqual([reply.id]);
  });

  it("has no discussion for an unknown lesson", () => {
    expect(viewer.getLessonThread(999)).toEqual([]);
  });

  it("finds a comment by id", () => {
    const comment = post(base.user.id, { body: "Q", at: 1 });

    expect(viewer.getCommentById(comment.id)?.body).toBe("Q");
    expect(viewer.getCommentById(999)).toBeUndefined();
  });
});

describe("rendering the discussion", () => {
  const author = {
    id: 1,
    name: "A",
    avatarUrl: null,
    isInstructor: false,
    isPlatformAdmin: false,
  };
  const node = (
    body: string,
    deleted: boolean,
    replies: ThreadComment[] = []
  ): ThreadComment => ({
    id: 1,
    body: markdown(body),
    createdAt: minute(1),
    editedAt: null,
    deleted,
    author,
    replies,
  });

  it("renders bodies to HTML, replies too, and nothing for a deleted comment", async () => {
    const [question, gone] = await renderThread([
      {
        ...node("**bold**", false),
        replies: [node("_reply_", false)] as never,
      },
      node("hidden", true),
    ]);

    expect(question.bodyHtml).toContain("<strong>bold</strong>");
    expect(question.replies[0].bodyHtml).toContain("<em>reply</em>");
    expect(gone.bodyHtml).toBe("");
  });
});
