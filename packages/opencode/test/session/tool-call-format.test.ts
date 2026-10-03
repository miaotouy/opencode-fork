import { describe, expect, test } from "bun:test"
import { ToolCallFormat } from "../../src/session/tool-call-format"

// \x3c / \x3e avoid literal angle brackets in this source so it can never be
// mistaken for a tool-call envelope by a downstream stream parser.
const L = "\x3c"
const R = "\x3e"
const SL = "\x3c/"
const tag = (name: string, attrs = "", closing = false) => `${closing ? SL : L}${name}${attrs}${R}`

describe("ToolCallFormat.leaked", () => {
  test("detects DeepSeek DSML envelopes", () => {
    expect(
      ToolCallFormat.leaked("改掉 dp 部分。｜｜DSML｜｜ parameter ｜｜DSML｜｜ invoke ｜｜DSML｜｜ calls"),
    ).toBe(true)
    expect(ToolCallFormat.leaked("text ||DSML|| parameter ||DSML|| invoke ||DSML|| calls")).toBe(true)
  })

  test("detects closed invoke and parameter envelopes", () => {
    const text =
      tag("invoke", ' name="read"') +
      tag("parameter", ' name="filePath"') +
      "/tmp/a.txt" +
      tag("parameter", "", true) +
      tag("invoke", "", true)
    expect(ToolCallFormat.leaked(text)).toBe(true)
  })

  test("detects closed tool_calls and function_calls envelopes", () => {
    expect(ToolCallFormat.leaked(tag("tool_calls") + "..." + tag("tool_calls", "", true))).toBe(true)
    expect(ToolCallFormat.leaked(tag("function_calls") + "..." + tag("function_calls", "", true))).toBe(true)
  })

  test("detects chat-template control tokens", () => {
    expect(ToolCallFormat.leaked("text " + L + "|python_tag|" + R)).toBe(true)
    expect(ToolCallFormat.leaked("text " + L + "|tool_call|" + R)).toBe(true)
  })

  test("ignores prose that merely names the markers", () => {
    expect(ToolCallFormat.leaked("Use the invoke and parameter fields to call tools.")).toBe(false)
    expect(ToolCallFormat.leaked("See the tool_calls and function_calls sections.")).toBe(false)
    expect(ToolCallFormat.leaked("")).toBe(false)
  })

  test("ignores unclosed envelopes", () => {
    expect(ToolCallFormat.leaked(tag("invoke", ' name="read"') + " no closing tag")).toBe(false)
  })

  test("matches caller-supplied extra patterns", () => {
    expect(ToolCallFormat.leaked("foo [[TOOLCALL]] bar", ["\\[\\[TOOLCALL\\]\\]"])).toBe(true)
    expect(ToolCallFormat.leaked("plain text", ["\\[\\[TOOLCALL\\]\\]"])).toBe(false)
  })

  test("ignores invalid extra patterns", () => {
    expect(ToolCallFormat.leaked("plain text", ["("])).toBe(false)
  })
})
