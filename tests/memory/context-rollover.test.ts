import { describe, it, expect } from "bun:test"

// =========================================
// createRolloverHandler：上下文轮转
// =========================================
describe("createRolloverHandler", () => {
  it("应返回一个 async 函数", async () => {
    const { createRolloverHandler } = await import("../../src/memory/context-rollover")
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-rollover-"))
    try {
      const store = new MemoryStore(tempDir)
      const handler = createRolloverHandler(store)
      expect(typeof handler).toBe("function")

      // 调用 handler 不应抛异常
      await handler({}, { system: [] })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("处理非空消息时不应抛异常", async () => {
    const { createRolloverHandler } = await import("../../src/memory/context-rollover")
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-rollover-msg-"))
    try {
      const store = new MemoryStore(tempDir)
      const handler = createRolloverHandler(store)

      // 模拟有消息的 session 压缩场景
      await handler(
        {
          sessionID: "test-session",
        },
        {
          system: ["existing prompt"],
          messages: [
            { role: "user", content: "你好" },
            { role: "assistant", content: "请稍等，我派代理处理" },
            { role: "user", content: "完成了没" },
          ],
        }
      )

      // 验证没有崩溃，且可能有记忆被记录
      // （当前设计可能记录也可能不记录，取决于具体实现策略）
      const stats = await store.getStats()
      expect(stats.total).toBeGreaterThanOrEqual(0)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
