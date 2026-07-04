import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// =========================================
// MemoryStore：基本文件存储引擎
// =========================================
describe("MemoryStore", () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "xagt-memory-test-"))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("append 一条记录后 query 能查到", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const store = new MemoryStore(tempDir)
    await store.append({ type: "lesson", content: "测试记忆条目" })
    const results = await store.query()
    expect(results.length).toBe(1)
    expect(results[0].content).toBe("测试记忆条目")
    expect(results[0].type).toBe("lesson")
    expect(results[0].timestamp).toBeDefined()
    // timestamp 应为有效的 ISO 字符串
    expect(new Date(results[0].timestamp).toISOString()).toBe(results[0].timestamp)
  })

  it("多次 append 后 query 返回全部记录（默认按时间倒序）", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-multi-append-"))
    try {
      const store = new MemoryStore(isolatedDir)
      await store.append({ type: "lesson", content: "first" })
      await store.append({ type: "decision", content: "second" })
      await new Promise(r => setTimeout(r, 10))
      await store.append({ type: "pattern", content: "third" })
      const results = await store.query()
      // 现在 isolatedDir 是干净的，只有此次写入的 3 条
      // query 按时间倒序返回，所以 third（最新）在前，first（最旧）在后
      expect(results.length).toBe(3)
      expect(results[0].content).toBe("third")
      expect(results[1].content).toBe("second")
      expect(results[2].content).toBe("first")
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("query 支持 limit 参数", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const store = new MemoryStore(tempDir)
    // 先清空状态：用新的隔离目录
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-memory-limit-"))
    try {
      const isolatedStore = new MemoryStore(isolatedDir)
      for (let i = 0; i < 5; i++) {
        await isolatedStore.append({ type: "lesson", content: `item-${i}` })
      }
      const all = await isolatedStore.query()
      expect(all.length).toBe(5)
      const limited = await isolatedStore.query({ limit: 2 })
      expect(limited.length).toBe(2)
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("query 支持 type 过滤", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-memory-type-"))
    try {
      const store = new MemoryStore(isolatedDir)
      await store.append({ type: "lesson", content: "l1" })
      await store.append({ type: "decision", content: "d1" })
      await store.append({ type: "pattern", content: "p1" })
      await store.append({ type: "lesson", content: "l2" })

      const lessons = await store.query({ type: "lesson" })
      expect(lessons.length).toBe(2)
      expect(lessons.every(r => r.type === "lesson")).toBe(true)

      const decisions = await store.query({ type: "decision" })
      expect(decisions.length).toBe(1)
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("query 支持 since 参数（只返回指定时间后的记录）", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-memory-since-"))
    try {
      const store = new MemoryStore(isolatedDir)
      await store.append({ type: "lesson", content: "before" })
      await new Promise(r => setTimeout(r, 20))
      const before = new Date().toISOString()
      await new Promise(r => setTimeout(r, 10))
      await store.append({ type: "lesson", content: "after" })

      const results = await store.query({ since: before })
      expect(results.length).toBe(1)
      expect(results[0].content).toBe("after")
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("超过 200 条时 rollover 自动裁剪到 200 条", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-memory-rollover-"))
    try {
      const store = new MemoryStore(isolatedDir)
      // 写入 210 条
      for (let i = 0; i < 210; i++) {
        await store.append({ type: "lesson", content: `item-${i}` })
      }
      const stats = await store.getStats()
      expect(stats.total).toBeLessThanOrEqual(200)
      expect(stats.byType.lesson).toBeLessThanOrEqual(200)
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("空目录初始化不报错", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const emptyDir = mkdtempSync(join(tmpdir(), "xagt-memory-empty-"))
    try {
      const store = new MemoryStore(emptyDir)
      const results = await store.query()
      expect(results).toEqual([])
      const stats = await store.getStats()
      expect(stats.total).toBe(0)
    } finally {
      rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it("损坏的 JSONL 行应被跳过不报错", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync, writeFileSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-corrupt-"))
    try {
      writeFileSync(join(isolatedDir, "memory.jsonl"),
        '{"type":"lesson","timestamp":"2026-01-01T00:00:00Z","content":"good"}\n' +
        '这不是合法 JSON\n' +
        '{"type":"lesson","timestamp":"2026-01-02T00:00:00Z","content":"also good"}\n',
        "utf-8"
      )
      const store = new MemoryStore(isolatedDir)
      const results = await store.query({ limit: 10 })
      expect(results.length).toBe(2)
      // query 按时间倒序，所以 "also good" (2026-01-02) 在前，"good" (2026-01-01) 在后
      expect(results[0].content).toBe("also good")
      expect(results[1].content).toBe("good")
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("getStats 返回正确的分类统计", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-memory-stats-"))
    try {
      const store = new MemoryStore(isolatedDir)
      await store.append({ type: "lesson", content: "l1" })
      await store.append({ type: "lesson", content: "l2" })
      await store.append({ type: "decision", content: "d1" })
      await store.append({ type: "pattern", content: "p1" })

      const stats = await store.getStats()
      expect(stats.total).toBe(4)
      expect(stats.byType.lesson).toBe(2)
      expect(stats.byType.decision).toBe(1)
      expect(stats.byType.pattern).toBe(1)
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })
})

// =========================================
// 边界测试
// =========================================
describe("MemoryStore 边界", () => {
  it("刚好 200 条时不应裁剪", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-boundary-200-"))
    try {
      const store = new MemoryStore(isolatedDir)
      for (let i = 0; i < 200; i++) {
        await store.append({ type: "lesson", content: `item-${i}` })
      }
      const stats = await store.getStats()
      expect(stats.total).toBe(200)
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("201 条时应只删除 1 条（保留 200 条）", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-boundary-201-"))
    try {
      const store = new MemoryStore(isolatedDir)
      for (let i = 0; i < 201; i++) {
        await store.append({ type: "lesson", content: `item-${i}` })
      }
      const stats = await store.getStats()
      expect(stats.total).toBe(200)
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("全文件损坏时应返回空数组", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync, writeFileSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-boundary-corrupt-"))
    try {
      writeFileSync(join(isolatedDir, "memory.jsonl"), "完全不是 JSON\n也不是 JSON\n", "utf-8")
      const store = new MemoryStore(isolatedDir)
      const results = await store.query()
      expect(results).toEqual([])
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("空文件（只有换行符）应返回空数组", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync, writeFileSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-boundary-empty-lines-"))
    try {
      writeFileSync(join(isolatedDir, "memory.jsonl"), "\n\n\n", "utf-8")
      const store = new MemoryStore(isolatedDir)
      const results = await store.query()
      expect(results).toEqual([])
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("since 参数指向未来时间时应返回空数组", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-boundary-future-"))
    try {
      const store = new MemoryStore(isolatedDir)
      await store.append({ type: "lesson", content: "old" })
      const futureTime = new Date(Date.now() + 86400000).toISOString() // 明天
      const results = await store.query({ since: futureTime })
      expect(results).toEqual([])
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("并发 append 不应丢数据", async () => {
    const { MemoryStore } = await import("../../src/memory/store")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-boundary-concurrent-"))
    try {
      const store = new MemoryStore(isolatedDir)
      // 同时发起 10 个 append
      const promises = Array.from({ length: 10 }, (_, i) =>
        store.append({ type: "lesson", content: `concurrent-${i}` })
      )
      await Promise.all(promises)
      const results = await store.query({ limit: 20 })
      expect(results.length).toBe(10)
      const contents = results.map(r => r.content).sort()
      for (let i = 0; i < 10; i++) {
        expect(contents).toContain(`concurrent-${i}`)
      }
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })
})
