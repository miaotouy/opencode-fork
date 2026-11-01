import type { SessionInfo, SessionMessageAssistant, SessionMessageInfo } from "@opencode/client/promise"

export type SessionExportData = { info: SessionInfo; messages: SessionMessageInfo[] }

export function sessionExportFilename(session: { id: string; title?: string; slug?: string }) {
  const name = [...(session.title || session.slug || session.id).trim()]
    .slice(0, 32)
    .join("")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
  return `${name || session.id}.json`
}

export function sessionMarkdownFilename(session: { id: string; title?: string; slug?: string }) {
  return sessionExportFilename(session).replace(/\.json$/, ".md")
}

export function renderSessionMarkdown(data: SessionExportData) {
  const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
  const models = [
    ...new Set(
      data.messages.flatMap((message) =>
        message.type === "assistant" ? [`${message.model.providerID}/${message.model.id}`] : [],
      ),
    ),
  ]
  const sections = [
    `# ${data.info.title || data.info.id}`,
    [
      "| Field | Value |",
      "| --- | --- |",
      `| Session | ${cell(data.info.id)} |`,
      `| Directory | ${cell(data.info.location.directory)} |`,
      `| Created | ${new Date(data.info.time.created).toISOString()} |`,
      `| Updated | ${new Date(data.info.time.updated).toISOString()} |`,
      ...(models.length ? [`| Models | ${cell(models.join(", "))} |`] : []),
    ].join("\n"),
  ]
  for (const message of data.messages) {
    if (message.type === "user") {
      const body = [
        message.text,
        ...(message.files ?? []).map((file) => `Attachment: ${file.name || file.description || file.mime}`),
      ]
        .filter(Boolean)
        .join("\n\n")
      if (body) sections.push(`## User\n\n${body}`)
    }
    if (message.type !== "assistant") continue
    const chunks = message.content.flatMap((part) => {
      if (part.type === "text") return [part.text]
      if (part.type === "reasoning") return part.text ? [`> ${part.text.replace(/\n/g, "\n> ")}`] : []
      return []
    })
    const tools = message.content.flatMap((part) => (part.type === "tool" ? [formatTool(part)] : []))
    if (tools.length) chunks.push(`<details>\n<summary>Tools</summary>\n\n${tools.join("\n")}\n</details>`)
    if (message.error) chunks.push(`> ${message.error.message}`)
    if (chunks.length) sections.push(`## Assistant\n\n${chunks.join("\n\n")}`)
  }
  return sections.join("\n\n").trimEnd() + "\n"
}

function formatTool(part: Extract<SessionMessageAssistant["content"][number], { type: "tool" }>) {
  if (part.state.status === "streaming") return `- \`${part.name}\` pending`
  if (part.state.status === "error") return `- \`${part.name}\` — ${part.state.error.message}`
  const input = Object.entries(part.state.input)
    .filter(([key]) => key !== "description")
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === "string" ? value.replace(/\s+/g, " ").slice(0, 200) : JSON.stringify(value).slice(0, 200)}`,
    )
    .join(", ")
  return `- \`${part.name}\`${input ? ` — ${input}` : ""}`
}
