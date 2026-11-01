import { describe, expect, test } from "bun:test"
import {
  renderSessionMarkdown,
  sessionExportFilename,
  sessionMarkdownFilename,
  type SessionExportData,
} from "./session-export"

describe("session export", () => {
  test.each([
    [{ id: "ses_123", title: "Clone PR in worktree from fork" }, "Clone-PR-in-worktree-from-fork"],
    [{ id: "ses_123", title: "中文会话 导出/说明" }, "中文会话-导出-说明"],
    [{ id: "ses_123", title: "😀".repeat(40) }, "😀".repeat(32)],
    [{ id: "ses_123", title: "a".repeat(40) }, "a".repeat(32)],
    [{ id: "ses_123", title: ' ./:*?"<>|. ' }, "ses_123"],
    [{ id: "ses_123", slug: "my-session-slug" }, "my-session-slug"],
    [{ id: "ses_123" }, "ses_123"],
  ])("uses a Unicode-safe bounded filename for %o", (session, name) => {
    expect(sessionExportFilename(session)).toBe(`${name}.json`)
    expect(sessionMarkdownFilename(session)).toBe(`${name}.md`)
  })

  test("renders native conversation order, attachments, reasoning and tool states", () => {
    const data: SessionExportData = {
      info: {
        id: "ses_export",
        projectID: "prj_export",
        title: "会话导出",
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        location: { directory: "E:/project" },
        time: { created: 0, updated: 1000 },
      },
      messages: [
        { type: "synthetic", id: "msg_notice", time: { created: 0 }, text: "internal continuation" },
        {
          type: "user",
          id: "msg_z",
          time: { created: 1000 },
          text: "Review this file",
          files: [{ data: "aGVsbG8=", mime: "text/plain", source: { type: "inline" }, name: "a.ts" }],
        },
        {
          type: "assistant",
          id: "msg_a",
          time: { created: 1000 },
          agent: "build",
          model: { providerID: "test", id: "model" },
          content: [
            { type: "reasoning", text: "First step\nSecond step" },
            {
              type: "tool",
              id: "call_1",
              name: "read",
              time: { created: 1000 },
              state: { status: "completed", input: { path: "src/a.ts" }, content: [{ type: "text", text: "code" }] },
            },
            {
              type: "tool",
              id: "call_2",
              name: "edit",
              time: { created: 1000 },
              state: { status: "error", input: {}, error: { type: "permission", message: "Denied" } },
            },
            {
              type: "tool",
              id: "call_3",
              name: "shell",
              time: { created: 1000 },
              state: { status: "streaming", input: "" },
            },
            { type: "text", text: "Review complete" },
          ],
        },
      ],
    }
    const markdown = renderSessionMarkdown(data)
    expect(markdown).toContain("# 会话导出")
    expect(markdown).toContain("E:/project")
    expect(markdown).toContain("test/model")
    expect(markdown).toContain("Attachment: a.ts")
    expect(markdown).toContain("> First step\n> Second step")
    expect(markdown).toContain("<summary>Tools</summary>")
    expect(markdown).toContain("path: src/a.ts")
    expect(markdown).toContain("Denied")
    expect(markdown).toContain("`shell` pending")
    expect(markdown.indexOf("## User")).toBeLessThan(markdown.indexOf("## Assistant"))
    expect(markdown).not.toContain("internal continuation")
  })
})
