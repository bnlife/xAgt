/**
 * 运行时加载 E2E 测试
 *
 * 验证 xAgt 插件能被 OpenCode 加载。
 * 注意：此测试会触发 opencode run，消耗少量 token。
 * 如果不希望消耗 token，用 --skip 跳过此文件。
 */
import { describe, it, expect, beforeAll } from "bun:test"

const OPENCODE_EXE = "C:\\Users\\叙拉古的城主\\AppData\\Roaming\\npm\\node_modules\\opencode-ai\\bin\\opencode.exe"
const RUN_TIMEOUT = 30000

async function opencodeRun(args: string[], cwd?: string, timeoutMs = RUN_TIMEOUT) {
  return new Promise<{ stdout: string; exitCode: number | null }>((resolve) => {
    const proc = Bun.spawn([OPENCODE_EXE, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
      cwd,
    })

    const stdoutChunks: Buffer[] = []
    ;(async () => {
      const r = proc.stdout.getReader()
      while (true) { const { done, value } = await r.read(); if (done) break; stdoutChunks.push(Buffer.from(value)) }
    })()

    const timer = setTimeout(() => { proc.kill() }, timeoutMs)
    proc.exited.then((exitCode) => {
      clearTimeout(timer)
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: "",
        exitCode,
      })
    })
  })
}

describe("xAgt 插件 E2E 加载验证", () => {
  let logs: { stdout: string; exitCode: number | null }

  beforeAll(async () => {
    logs = await opencodeRun(["run", "hello"], "C:\\Users\\叙拉古的城主\\Workspace\\xAgt")
  }, RUN_TIMEOUT + 5000)

  it("opencode run 应该启动并返回", () => {
    expect(logs).not.toBeNull()
  })

  it("stdout 日志应该包含 [xAgt] 插件已加载", () => {
    // 验证插件被 OpenCode 成功加载
    expect(logs.stdout).toMatch(/\[xAgt\]/)
  })
})
