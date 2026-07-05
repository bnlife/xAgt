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

  it("应按类型正确显示标签", async () => {
    const { buildMemoryContext } = await import("../../src/memory/hierarchy")
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-hierarchy-labels-"))
    try {
      const store = new MemoryStore(tempDir)
      await store.append({ type: "lesson", content: "always lint before commit" })
      await store.append({ type: "pattern", content: "use async/await for IO" })
      await store.append({ type: "decision", content: "chose TypeScript over JavaScript" })

      const result = await buildMemoryContext(store)
      expect(result.longTermMemory).toContain("[Lesson]")
      expect(result.longTermMemory).toContain("[Pattern]")
      expect(result.longTermMemory).toContain("[Decision]")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("超长记忆应被截断", async () => {
    const { buildMemoryContext } = await import("../../src/memory/hierarchy")
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-hierarchy-long-"))
    try {
      const store = new MemoryStore(tempDir)
      const longContent = "A".repeat(300)
      await store.append({ type: "lesson", content: longContent })
      const result = await buildMemoryContext(store)
      // 输出中不应包含完整 300 字符
      expect(result.longTermMemory.length).toBeLessThan(longContent.length + 100)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it("多条同类型记忆应正确聚合", async () => {
    const { buildMemoryContext } = await import("../../src/memory/hierarchy")
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")

    const tempDir = mkdtempSync(join(tmpdir(), "xagt-hierarchy-multi-"))
    try {
      const store = new MemoryStore(tempDir)
      await store.append({ type: "lesson", content: "lesson one" })
      await store.append({ type: "lesson", content: "lesson two" })
      const result = await buildMemoryContext(store)
      expect(result.longTermMemory).toContain("lesson one")
      expect(result.longTermMemory).toContain("lesson two")
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
