import type { Message, Part, Session } from "@opencode-ai/sdk/v2/client"

// Rendered markdown should read as a chat log: one section per user prompt,
// assistant replies and tool activity folded underneath, noise parts dropped.
export function sessionToMarkdown(data: { info: Session; messages: { info: Message; parts: Part[] }[] }): string {
  const messages = [...data.messages].sort(
    (a, b) => (a.info.time?.created ?? 0) - (b.info.time?.created ?? 0) || a.info.id.localeCompare(b.info.id),
  )

  const sections: string[] = [`# ${data.info.title}`, formatMetadata(data.info, collectModels(data.messages))]

  for (const message of messages) {
    const body = message.info.role === "user" ? formatUser(message.parts) : formatAssistant(message.parts)
    if (!body) continue
    const heading = message.info.role === "user" ? "User" : "Assistant"
    sections.push(`## ${heading}\n\n${body}`)
  }

  return sections.join("\n\n").trimEnd() + "\n"
}

function formatMetadata(session: Session, models: string[]): string {
  const rows: string[] = [
    `| Session | \`${session.id}\` |`,
    `| Directory | \`${session.directory}\` |`,
    `| Created | ${new Date(session.time.created).toISOString()} |`,
    `| Updated | ${new Date(session.time.updated).toISOString()} |`,
  ]
  if (session.summary) {
    rows.push(
      `| Changes | +${session.summary.additions} / -${session.summary.deletions} across ${session.summary.files} files |`,
    )
  }
  if (models.length > 0) {
    rows.push(`| Models | ${[...new Set(models)].join(", ")} |`)
  }

  return ["| Field | Value |", "| --- | --- |", ...rows].join("\n")
}

function collectModels(messages: { info: Message; parts: Part[] }[]): string[] {
  const names: string[] = []
  for (const message of messages) {
    if (message.info.role !== "assistant") continue
    names.push(`${message.info.providerID}/${message.info.modelID}`)
  }
  return [...new Set(names)]
}

function formatUser(parts: Part[]): string {
  const chunks: string[] = []
  for (const part of parts) {
    if (part.type === "text" && !part.synthetic) chunks.push(part.text)
    if (part.type === "file") chunks.push(formatFile(part))
    if (part.type === "subtask") chunks.push(`> ${part.description}`)
  }
  return chunks.join("\n\n")
}

function formatAssistant(parts: Part[]): string {
  const chunks: string[] = []
  const tools: string[] = []

  for (const part of parts) {
    if (part.type === "text") chunks.push(part.text)
    if (part.type === "reasoning") chunks.push(`> ${part.text.replace(/\n/g, "\n> ")}`)
    if (part.type === "tool") tools.push(formatTool(part))
  }

  if (tools.length > 0) {
    chunks.push("<details>\n<summary>Tools</summary>\n\n" + tools.join("\n") + "\n</details>")
  }

  return chunks.join("\n\n")
}

function formatTool(part: Extract<Part, { type: "tool" }>): string {
  const state = part.state
  const title = state.status === "completed" || state.status === "running" ? state.title : undefined
  const label = title || part.tool

  if (state.status === "pending") return `- \`${part.tool}\` pending`
  if (state.status === "error") return `- \`${label}\` — \`${state.error}\``

  const input = Object.entries(state.input ?? {})
  const details = input
    .filter(([key]) => key !== "description")
    .map(([key, value]) => `${key}: ${stringify(value)}`)
    .join(", ")

  return `- \`${label}\`${details ? ` — ${details}` : ""}`
}

function formatFile(part: Extract<Part, { type: "file" }>): string {
  const name = part.filename || part.url
  return `Attachment: ${name}`
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").slice(0, 200)
  if (value === undefined || value === null) return ""
  return JSON.stringify(value).slice(0, 200)
}
