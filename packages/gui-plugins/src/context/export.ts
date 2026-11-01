import type { OpenCodeClient } from "@opencode/client/promise"
export {
  sessionExportFilename,
  sessionMarkdownFilename,
  renderSessionMarkdown,
} from "@opencode/session-ui/session-export"

export async function fetchSessionExport(input: {
  sessionID: string
  api: Pick<OpenCodeClient, "session" | "message">
}) {
  const [info, first] = await Promise.all([
    input.api.session.get({ sessionID: input.sessionID }),
    input.api.message.list({ sessionID: input.sessionID, limit: 200, order: "asc" }),
  ])

  const pages = [first]

  while (pages.at(-1)?.cursor.next) {
    pages.push(
      await input.api.message.list({
        sessionID: input.sessionID,
        limit: 200,
        cursor: pages.at(-1)!.cursor.next ?? undefined,
      }),
    )
  }

  return {
    info,
    messages: pages.flatMap((page) => page.data),
  }
}
