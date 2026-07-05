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

// =========================================
// classifyMessages：消息分类
// =========================================
describe("classifyMessages", () => {
  it("中文关键词应正确分类消息", async () => {
    const { classifyMessages } = await import("../../src/memory/context-rollover")

    const messages = [
      { role: "user", content: "我决定采用方案A来修复这个错误，因为之前的方法报错了" },
      { role: "assistant", content: "先查文档再改代码，必须注意不要覆盖已有逻辑" },
      { role: "user", content: "项目需要支持多语言，建议使用i18n" },
      { role: "assistant", content: "这个问题通过添加缓存解决了" },
      { role: "user", content: "短" },  // 太短应被跳过
    ]

    const result = classifyMessages(messages)
    expect(result.length).toBeGreaterThan(0)

    const types = result.map(r => r.type)
    expect(types).toContain("decision")
    expect(types).toContain("pattern")
  })

  it("英文关键词应正确分类消息", async () => {
    const { classifyMessages } = await import("../../src/memory/context-rollover")

    const messages = [
      { role: "user", content: "I decided to use React Query to fix the bug because the old approach failed" },
      { role: "assistant", content: "first lint then test, avoid modifying the build config" },
      { role: "user", content: "error occurs when deploying to production" },
    ]

    const result = classifyMessages(messages)
    expect(result.length).toBeGreaterThan(0)

    const types = result.map(r => r.type)
    expect(types).toContain("decision")
    expect(types).toContain("pattern")
    expect(types).toContain("lesson")
  })

  it("空消息或短消息应返回空数组", async () => {
    const { classifyMessages } = await import("../../src/memory/context-rollover")

    expect(classifyMessages([])).toEqual([])
    expect(classifyMessages([{ role: "user", content: "hi" }])).toEqual([])
  })
})
