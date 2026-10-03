/**
 * Detect tool-call markup that leaked into assistant text or reasoning instead
 * of being emitted through the provider's tool-call channel.
 *
 * Some models print their native tool-call envelope as ordinary text when the
 * endpoint does not translate it (for example DeepSeek's `｜｜DSML｜｜` blocks).
 * Without this check the call is silently treated as prose and never executed,
 * so the turn ends as a normal "stop" with no tool result to feed back.
 *
 * Detection is intentionally conservative: it matches only finished envelopes
 * or unambiguous model-specific tokens, so a model discussing these tags in
 * prose does not trip it.
 */

// Full-width ｜ (U+FF5C) or ASCII | surrounding the DSML marker.
const DSML = /[｜|]{2}\s*DSML\s*[｜|]{2}/i

// Chat-template control tokens some models emit when the endpoint drops the
// structured tool-call field.
const SPECIAL_TOKENS = /<\|(?:python_tag|tool_call|tool_calls?_section_(?:begin|end))\|>/i

// Closed XML-ish envelopes. Requiring both an opening and a closing tag keeps
// false positives low when the markers only appear as quoted prose.
const ENVELOPES: ReadonlyArray<RegExp> = [
  /<\s*(?:antml:)?invoke\b[^>]*>[\s\S]*?<\s*\/\s*(?:antml:)?invoke\s*>/i,
  /<\s*(?:antml:)?parameter\b[^>]*>[\s\S]*?<\s*\/\s*(?:antml:)?parameter\s*>/i,
  /<\s*(?:tool_calls?|function_calls?)\b[^>]*>[\s\S]*?<\s*\/\s*(?:tool_calls?|function_calls?)\s*>/i,
]

function compile(patterns: ReadonlyArray<string>): ReadonlyArray<RegExp> {
  return patterns.flatMap((pattern) => {
    try {
      return [new RegExp(pattern, "i")]
    } catch {
      return []
    }
  })
}

export function leaked(text: string, extraPatterns: ReadonlyArray<string> = []): boolean {
  if (!text) return false
  if (DSML.test(text) || SPECIAL_TOKENS.test(text)) return true
  if (ENVELOPES.some((pattern) => pattern.test(text))) return true
  return compile(extraPatterns).some((pattern) => pattern.test(text))
}

export const REMINDER = `Your previous response did not actually call any tool. Tool-call markup was written as plain text (in the message body or reasoning) instead of being emitted through the tool-calling channel, so no tool ran.

Retry now using the tool-calling mechanism provided in this request: emit the tool name and arguments through that channel. Do NOT write tool-call tags (for example invoke / parameter / tool_calls) or raw special tokens into your message body or reasoning.`

export * as ToolCallFormat from "./tool-call-format"
