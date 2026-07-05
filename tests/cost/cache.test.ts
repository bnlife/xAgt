import { describe, it, expect, beforeEach } from "bun:test"

describe("ToolResultCache", () => {
  beforeEach(async () => {
    // 每个测试前清理缓存
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.clear()
  })

  it("get/set 正常存取", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.set("grep:foo:src", ["file1.ts", "file2.ts"])
    const result = ToolResultCache.get("grep:foo:src")
    expect(result).toEqual(["file1.ts", "file2.ts"])
  })

  it("不存在的 key 返回 undefined", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    expect(ToolResultCache.get("nonexistent")).toBeUndefined()
  })

  it("超过 TTL 的缓存应过期", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.set("test:key", "value", { ttlMs: 50 })
    expect(ToolResultCache.get("test:key")).toBe("value")
    // 等待 TTL 过期
    await new Promise(r => setTimeout(r, 60))
    expect(ToolResultCache.get("test:key")).toBeUndefined()
  })

  it("超过最大条目数时淘汰最旧的", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    // 设置最大 3 条
    for (let i = 0; i < 3; i++) {
      ToolResultCache.set(`key-${i}`, i, { maxEntries: 3 })
    }
    // 第 4 条应淘汰 key-0
    ToolResultCache.set(`key-3`, 3, { maxEntries: 3 })
    expect(ToolResultCache.get("key-0")).toBeUndefined()
    expect(ToolResultCache.get("key-1")).toBeDefined()
    expect(ToolResultCache.get("key-2")).toBeDefined()
    expect(ToolResultCache.get("key-3")).toBeDefined()
  })

  it("invalidateByPrefix 按前缀清除", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.set("grep:src/a", "result-a")
    ToolResultCache.set("grep:src/b", "result-b")
    ToolResultCache.set("glob:src", "result-c")
    ToolResultCache.invalidateByPrefix("grep:")
    expect(ToolResultCache.get("grep:src/a")).toBeUndefined()
    expect(ToolResultCache.get("grep:src/b")).toBeUndefined()
    expect(ToolResultCache.get("glob:src")).toBeDefined()
  })

  it("getStats 返回正确的统计信息", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.set("key-a", 1)
    ToolResultCache.set("key-b", 2)
    const stats = ToolResultCache.getStats()
    expect(stats.size).toBe(2)
    expect(typeof stats.oldest).toBe("number")
    expect(typeof stats.newest).toBe("number")
  })

  it("getStats 的 oldest/newest 应反映创建时间", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.clear()

    ToolResultCache.set("key-a", "a", { maxEntries: 5 })
    await new Promise(r => setTimeout(r, 5))
    ToolResultCache.set("key-b", "b", { maxEntries: 5 })

    const stats1 = ToolResultCache.getStats()
    expect(stats1.size).toBe(2)
    // newest 应 >= oldest
    expect(stats1.newest).toBeGreaterThanOrEqual(stats1.oldest)

    // 访问 key-a 使其变为最新
    ToolResultCache.get("key-a")

    const stats2 = ToolResultCache.getStats()
    expect(stats2.size).toBe(2)
    // newest 应保持（基于创建时间）
    expect(stats2.newest).toBeGreaterThanOrEqual(stats1.newest)
  })

  it("clear 后 getStats 应返回 size=0", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.set("x", 1)
    ToolResultCache.clear()
    const stats = ToolResultCache.getStats()
    expect(stats.size).toBe(0)
  })

  it("自定义 TTL 的缓存条目应正确过期", async () => {
    const { ToolResultCache } = await import("../../src/cost/cache")
    ToolResultCache.clear()

    // 设置 2 个条目，不同 TTL
    ToolResultCache.set("short", "s", { ttlMs: 30 })
    ToolResultCache.set("long", "l", { ttlMs: 5000 })

    expect(ToolResultCache.get("short")).toBe("s")
    expect(ToolResultCache.get("long")).toBe("l")

    await new Promise(r => setTimeout(r, 40))

    expect(ToolResultCache.get("short")).toBeUndefined()
    expect(ToolResultCache.get("long")).toBe("l")  // 未过期
  })
})
