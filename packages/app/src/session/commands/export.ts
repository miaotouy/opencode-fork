import { renderSessionMarkdown, type SessionExportData } from "@opencode/session-ui/session-export"
export {
  sessionExportFilename,
  sessionMarkdownFilename,
  renderSessionMarkdown,
} from "@opencode/session-ui/session-export"
export type { SessionExportData } from "@opencode/session-ui/session-export"
import type { ServerApi } from "@/runtime/server/api"
import type { Platform } from "@/runtime/platform/platform"

export async function fetchSessionExport(input: {
  sessionID: string
  api: Pick<ServerApi, "session" | "message">
}): Promise<SessionExportData> {
  const [info, first] = await Promise.all([
    input.api.session.get({ sessionID: input.sessionID }),
    input.api.message.list({ sessionID: input.sessionID, limit: 200, order: "asc" }, { mediaRefs: false }),
  ])

  const pages = [first]

  while (pages.at(-1)?.cursor.next) {
    pages.push(
      await input.api.message.list(
        {
          sessionID: input.sessionID,
          limit: 200,
          cursor: pages.at(-1)!.cursor.next ?? undefined,
        },
        { mediaRefs: false },
      ),
    )
  }

  return {
    info,
    messages: pages.flatMap((page) => page.data),
  }
}

export function downloadSessionExport(filename: string, data: SessionExportData) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json")
}

export function downloadTextFile(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function saveSessionExport(
  filename: string,
  data: SessionExportData,
  platform: Pick<Platform, "saveFile">,
) {
  if (!platform.saveFile) {
    downloadSessionExport(filename, data)

    return true
  }

  return platform.saveFile({ defaultPath: filename }, JSON.stringify(data, null, 2))
}

export async function saveSessionMarkdown(
  filename: string,
  data: SessionExportData,
  platform: Pick<Platform, "saveFile">,
) {
  const content = renderSessionMarkdown(data)
  if (platform.saveFile) return platform.saveFile({ defaultPath: filename }, content)
  downloadTextFile(filename, content)
  return true
}
