import { describe, expect, test } from "bun:test"
import semver from "semver"
import path from "path"

async function metadata(env: Record<string, string | undefined>) {
  const child = Bun.spawn({
    cmd: [
      process.execPath,
      "--eval",
      'const { Script } = await import("./src/index.ts"); console.log("metadata:" + JSON.stringify(Script))',
    ],
    cwd: path.resolve(import.meta.dir, ".."),
    env: {
      ...process.env,
      OPENCODE_CHANNEL: undefined,
      OPENCODE_BUMP: undefined,
      OPENCODE_VERSION: undefined,
      OPENCODE_RELEASE: undefined,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code !== 0) throw new Error(stderr || stdout)
  const line = stdout.split(/\r?\n/).find((line) => line.startsWith("metadata:"))
  if (!line) throw new Error(`Missing build metadata: ${stdout}`)
  return JSON.parse(line.slice("metadata:".length)) as { version: string; channel: string; preview: boolean }
}

describe("build version", () => {
  test.each(["dev", "beta"])("uses the source version for the %s channel", async (channel) => {
    const pkg = await Bun.file(path.resolve(import.meta.dir, "../../core/package.json")).json()
    const result = await metadata({ OPENCODE_CHANNEL: channel })

    expect(semver.valid(result.version)).toBe(result.version)
    expect(`${semver.major(result.version)}.${semver.minor(result.version)}.${semver.patch(result.version)}`).toBe(
      pkg.version,
    )
    expect(result.version).toMatch(new RegExp(`-${channel}\\.\\d{12}$`))
    expect(semver.gte(result.version, "1.18.0")).toBe(true)
    expect(result.channel).toBe(channel)
    expect(result.preview).toBe(true)
  })

  test("keeps explicit stable versions and channel overrides", async () => {
    expect(await metadata({ OPENCODE_VERSION: "1.18.34" })).toMatchObject({
      version: "1.18.34",
      channel: "latest",
      preview: false,
    })
    expect(await metadata({ OPENCODE_VERSION: "1.18.34", OPENCODE_CHANNEL: "beta" })).toMatchObject({
      version: "1.18.34",
      channel: "beta",
      preview: true,
    })
  })

  test.each(["1.18.34-dev.202610190000", "0.0.0-dev-202610061952"])(
    "keeps %s as a preview when passed to a child build",
    async (version) => {
      const result = await metadata({ OPENCODE_VERSION: version })
      expect(result.version).toBe(version)
      expect(result.preview).toBe(true)
    },
  )
})
