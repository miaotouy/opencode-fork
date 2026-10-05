import { describe, expect, test } from "bun:test"
import { sessionToMarkdown } from "./session-markdown"
import type { Message, Part, Session } from "@opencode-ai/sdk/v2/client"

const session = { id: "ses_1", title: "Fix the bug", directory: "/repo", time: { created: 1, updated: 2 } } as Session

const METADATA = `| Field | Value |
| --- | --- |
| Session | \`ses_1\` |
| Directory | \`/repo\` |
| Created | 1970-01-01T00:00:00.001Z |
| Updated | 1970-01-01T00:00:00.002Z |
| Models | anthropic/claude-sonnet-4-20250514 |
`

const user = (parts: Part[]): { info: Message; parts: Part[] } => ({
  info: { id: "msg_u", sessionID: "ses_1", role: "user", time: { created: 1 } } as Message,
  parts,
})

const assistant = (parts: Part[]): { info: Message; parts: Part[] } => ({
  info: {
    id: "msg_a",
    sessionID: "ses_1",
    role: "assistant",
    time: { created: 2 },
    providerID: "anthropic",
    modelID: "claude-sonnet-4-20250514",
  } as Message,
  parts,
})

test("renders title, user text and assistant reply", () => {
  const md = sessionToMarkdown({
    info: session,
    messages: [
      user([{ id: "p1", type: "text", text: "please fix" } as Part]),
      assistant([{ id: "p2", type: "text", text: "done" } as Part]),
    ],
  })

  expect(md).toContain("# Fix the bug")
  expect(md).toContain("## User\n\nplease fix")
  expect(md).toContain("## Assistant\n\ndone")
  expect(md.indexOf("## User")).toBeLessThan(md.indexOf("## Assistant"))
})

test("drops synthetic, step and snapshot parts", () => {
  const md = sessionToMarkdown({
    info: session,
    messages: [
      user([
        { id: "p1", type: "text", text: "hi", synthetic: true } as Part,
        { id: "p2", type: "step-start" } as Part,
      ]),
      assistant([
        { id: "p3", type: "step-finish", reason: "x", cost: 0, tokens: {} } as Part,
        { id: "p4", type: "snapshot", snapshot: "abc" } as Part,
        { id: "p5", type: "text", text: "ok" } as Part,
      ]),
    ],
  })

  expect(md).toBe(`# Fix the bug\n\n${METADATA}\n## Assistant\n\nok\n`)
})

test("folds tool calls into a details block", () => {
  const md = sessionToMarkdown({
    info: session,
    messages: [
      assistant([
        { id: "p1", sessionID: "ses_1", messageID: "msg_a", callID: "c1", type: "tool", tool: "bash", state: { status: "completed", input: { command: "ls" }, output: "a\nb", title: "ls", metadata: {}, time: { start: 1, end: 2 } } } as Part,
        { id: "p2", type: "text", text: "listed" } as Part,
      ]),
    ],
  })

  expect(md).toContain("<details>")
  expect(md).toContain("- `ls` — command: ls")
  expect(md).toContain("listed")
  expect(md).not.toContain("a\nb")
})

test("renders reasoning as blockquote", () => {
  const md = sessionToMarkdown({
    info: session,
    messages: [assistant([{ id: "p1", type: "reasoning", text: "line1\nline2" } as Part])],
  })

  expect(md).toContain("> line1\n> line2")
})

test("omits empty messages entirely", () => {
  const md = sessionToMarkdown({
    info: session,
    messages: [user([{ id: "p1", type: "compaction", auto: true } as Part])],
  })

  expect(md).toContain("# Fix the bug")
  expect(md).not.toContain("## User")
})

test("metadata block includes session fields and assistant models", () => {
  const info = {
    ...session,
    id: "ses_meta",
    directory: "/repo",
    time: { created: 1759000000000, updated: 1759000100000 },
    summary: { additions: 10, deletions: 2, files: 3 },
  } as Session

  const md = sessionToMarkdown({
    info,
    messages: [
      assistant([
        { id: "p1", type: "text", text: "hey" } as Part,
      ]),
    ],
  })

  expect(md).toContain("| Field | Value |")
  expect(md).toContain("| Session | `ses_meta` |")
  expect(md).toContain("| Directory | `/repo` |")
  expect(md).toContain("+10 / -2 across 3 files")
  expect(md).toContain("anthropic/claude-sonnet-4-20250514")
})
