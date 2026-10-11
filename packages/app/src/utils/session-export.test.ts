import type { Message, Part, Session } from "@opencode-ai/sdk/v2/client";
import { describe, expect, test } from "bun:test";

import { fetchSessionExport, sessionExportFilename, sessionMarkdownFilename } from "./session-export";


describe("sessionExportFilename", () => {
  test("keeps the first 32 characters of the title", () => {
    expect(sessionExportFilename({ id: "ses_123", title: "Clone PR in worktree from fork" })).toBe(
      "Clone-PR-in-work.json",
    )
  })

  test("preserves non-latin titles such as Chinese", () => {
    expect(sessionExportFilename({ id: "ses_123", title: "修复导出文件名的问题" })).toBe("修复导出文件名的问题.json")
  })

  test("truncates long non-latin titles to 32 characters", () => {
    expect(sessionExportFilename({ id: "ses_123", title: "这是一个非常非常非常长的会话标题名称" })).toBe(
      "这是一个非常非常非常长的会话标题.json",
    )
  })

  test("replaces filesystem-illegal characters", () => {
    expect(sessionExportFilename({ id: "ses_123", title: "Fix: bug/issue" })).toBe("Fix-bug-issue.json")
  })

  test("generates filename from slug when title missing", () => {
    expect(sessionExportFilename({ id: "ses_123", slug: "my-session-slug" })).toBe("my-session-slug.json")
  })

  test("falls back to id when title and slug are empty", () => {
    expect(sessionExportFilename({ id: "ses_123" })).toBe("ses_123.json")
  })
})

describe("sessionMarkdownFilename", () => {
  test("swaps the extension for markdown exports", () => {
    expect(sessionMarkdownFilename({ id: "ses_123", title: "修复导出" })).toBe("修复导出.md")
  })
})

describe("fetchSessionExport", () => {
  test("fetches full transcript from client", async () => {
    const session = { id: "ses_1", title: "Test Session" } as Session
    const msg = { id: "msg_1", role: "user" } as Message
    const part = { id: "prt_1", type: "text", text: "hello" } as Part
    const messages = [{ info: msg, parts: [part] }]

    const client = {
      session: {
        get: async () => ({ data: session }),
        messages: async () => ({ data: messages }),
      },
    }

    const result = await fetchSessionExport({
      sessionID: "ses_1",
      client,
    })

    expect(result).toEqual({
      info: session,
      messages,
    })
  })

  test("throws when session not found", async () => {
    const client = {
      session: {
        get: async () => ({ data: null }),
        messages: async () => ({ data: [] }),
      },
    }

    expect(
      fetchSessionExport({
        sessionID: "ses_missing",
        client,
      }),
    ).rejects.toThrow("Session not found: ses_missing")
  })
})
