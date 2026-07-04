import { describe, it, expect } from "bun:test"

// =========================================
// buildMemoryContext：三级记忆注入
// =========================================
describe("buildMemoryContext", () => {
  it("应返回 projectMemory 和 longTermMemory 字段", async () => {
    const { buildMemoryContext } = await import("../../src/memory/hierarchy")
    // 使用 MemoryStore 配合测试
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-hierarchy-"))
    try {
      const store = new MemoryStore(tempDir)
      await store.append({ type: "lesson", content: "always test before commit" })

      const result = await buildMemoryContext(store)
      expect(result).toHaveProperty("projectMemory")
      expect(result).toHaveProperty("longTermMemory")
      expect(typeof result.projectMemory).toBe("string")
      expect(typeof result.longTermMemory).toBe("string")
      // 长期记忆应包含刚写入的 lesson
      expect(result.longTermMemory).toContain("always test before commit")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("无记忆文件时不应抛异常", async () => {
    const { buildMemoryContext } = await import("../../src/memory/hierarchy")
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const emptyDir = mkdtempSync(join(tmpdir(), "xagt-hierarchy-empty-"))
    try {
      const store = new MemoryStore(emptyDir)
      const result = await buildMemoryContext(store)
      expect(result.projectMemory).toBe("")
      expect(result.longTermMemory).toBe("")
    } finally {
      rmSync(emptyDir, { recursive: true, force: true })
    }
  })
})
