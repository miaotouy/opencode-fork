import type { Message, Part, Session } from "@opencode-ai/sdk/v2/client";

import { sessionToMarkdown } from "./session-markdown";


// Matches the exact `{ info, messages: [{ info, parts }] }` structure produced by `opencode export` CLI
export type SessionExportData = {
  info: Session
  messages: {
    info: Message
    parts: Part[]
  }[]
}

export type SessionExportClient = {
  session: {
    get: (input: { sessionID: string }) => Promise<{ data?: Session | null }>
    messages: (input: { sessionID: string }) => Promise<{ data?: SessionExportData["messages"] | null }>
  }
}

export async function fetchSessionExport(input: {
  sessionID: string
  client: SessionExportClient
}): Promise<SessionExportData> {
  const [sessionRes, messagesRes] = await Promise.all([
    input.client.session.get({ sessionID: input.sessionID }),
    input.client.session.messages({ sessionID: input.sessionID }),
  ])

  if (!sessionRes?.data) {
    throw new Error(`Session not found: ${input.sessionID}`)
  }
  if (!messagesRes?.data) {
    throw new Error(`Failed to load messages for session: ${input.sessionID}`)
  }

  return {
    info: sessionRes.data,
    messages: messagesRes.data,
  }
}

const FILENAME_TITLE_LENGTH = 32

export function sessionExportFilename(session: { id: string; title?: string; slug?: string }) {
  const name = filenameSegment(session.title || session.slug || session.id)
  return `${name || session.id}.json`
}

// Keep the first characters of the title, including non-latin scripts such as Chinese,
// then replace the characters a filesystem would reject.
function filenameSegment(input: string) {
  return [...input.trim()]
    .slice(0, FILENAME_TITLE_LENGTH)
    .join("")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
}

export function sessionMarkdownFilename(session: { id: string; title?: string; slug?: string }) {
  return sessionExportFilename({ ...session, title: session.title || session.slug || session.id }).replace(
    /\.json$/,
    ".md",
  )
}

export function renderSessionMarkdown(data: SessionExportData) {
  return sessionToMarkdown(data)
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

export function downloadSessionExport(filename: string, data: unknown) {
  const json = JSON.stringify(data, null, 2)
  downloadTextFile(filename, json, "application/json")
}
