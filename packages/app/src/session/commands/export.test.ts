import { describe, expect, test } from "bun:test"
import type { SessionInfo, SessionMessageInfo } from "@opencode/client/promise"
import type { ServerApi, ServerRequestOptions } from "@/runtime/server/api"
import type { Platform } from "@/runtime/platform/platform"
import { fetchSessionExport, saveSessionExport, saveSessionMarkdown } from "./export"

/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion, anti-slop/no-chained-type-assertions -- partial fixtures stand in for API records the export only passes through */

describe("fetchSessionExport", () => {
  test("fetches every native message page with inline media and without exporting cursors", async () => {
    const info = { id: "ses_1", title: "Test Session" } as SessionInfo
    const first = { id: "msg_1", type: "model-selected" } as unknown as SessionMessageInfo
    const second = { id: "msg_2", type: "user" } as SessionMessageInfo
    const calls: unknown[] = []

    const api = {
      session: { get: async () => info },
      message: {
        list: async (input: { cursor?: string }, options: ServerRequestOptions) => {
          calls.push([input, options])

          if (!input.cursor) return { data: [first], cursor: { next: "page-2" } }

          return { data: [second], cursor: {} }
        },
      },
    } as unknown as Pick<ServerApi, "session" | "message">

    const result = await fetchSessionExport({ sessionID: "ses_1", api })

    expect(result).toEqual({ info, messages: [first, second] })
    expect(result).not.toHaveProperty("cursor")
    expect(calls).toEqual([
      [{ sessionID: "ses_1", limit: 200, order: "asc" }, { mediaRefs: false }],
      [{ sessionID: "ses_1", limit: 200, cursor: "page-2" }, { mediaRefs: false }],
    ])
  })
})

describe("saveSessionExport", () => {
  test.each([true, false])("writes pretty JSON to the native save dialog and returns %p", async (saved) => {
    const writes: string[][] = []

    const platform: Pick<Platform, "saveFile"> = {
      saveFile: async (options, content) => {
        writes.push([options.defaultPath ?? "", content])

        return saved
      },
    }

    const data = { info: { id: "ses_1" } as SessionInfo, messages: [] }

    expect(await saveSessionExport("session.json", data, platform)).toBe(saved)
    expect(writes).toEqual([["session.json", '{\n  "info": {\n    "id": "ses_1"\n  },\n  "messages": []\n}']])
  })
})

test("saves Markdown through the native dialog and preserves cancellation", async () => {
  const writes: string[][] = []
  const data = {
    info: {
      id: "ses_1",
      title: "Test Session",
      location: { directory: "/project" },
      time: { created: 0, updated: 0 },
    } as SessionInfo,
    messages: [],
  }
  const saved = await saveSessionMarkdown("session.md", data, {
    saveFile: async (options, content) => {
      writes.push([options.defaultPath ?? "", content])
      return false
    },
  })
  expect(saved).toBe(false)
  expect(writes).toHaveLength(1)
  expect(writes[0]?.[0]).toBe("session.md")
  expect(writes[0]?.[1]).toStartWith("# Test Session\n")
})
