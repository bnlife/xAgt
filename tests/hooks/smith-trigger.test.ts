import { describe, it, expect } from "bun:test"

// =========================================
// Smith Trigger — 频率计数器
// =========================================
describe("createSmithTrigger", () => {
  it("应返回 activate 和 getCounter 方法", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    expect(trigger.activate).toBeDefined()
    expect(typeof trigger.activate).toBe("function")
    expect(trigger.getCounter).toBeDefined()
    expect(typeof trigger.getCounter).toBe("function")
  })

  it("初始计数值应为 0", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    expect(trigger.getCounter("session-1")).toBe(0)
  })

  it("每次 activate 调用应增加计数", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    trigger.activate("session-a")
    expect(trigger.getCounter("session-a")).toBe(1)
    trigger.activate("session-a")
    expect(trigger.getCounter("session-a")).toBe(2)
  })

  it("不同 session 的计数应隔离", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    trigger.activate("session-1")
    trigger.activate("session-1")
    trigger.activate("session-2")
    expect(trigger.getCounter("session-1")).toBe(2)
    expect(trigger.getCounter("session-2")).toBe(1)
  })

  it("shouldActivate 在未达阈值时返回 false", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger({ everyNTurns: 5 })
    for (let i = 0; i < 4; i++) {
      trigger.activate("test-session")
    }
    // 第 4 次后，计数为 4，不应激活
    expect(trigger.shouldActivate("test-session")).toBe(false)
    expect(trigger.getCounter("test-session")).toBe(4)
  })

  it("shouldActivate 在达到阈值时返回 true 并重置计数", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger({ everyNTurns: 5 })
    for (let i = 0; i < 5; i++) {
      trigger.activate("test-session")
    }
    // 第 5 次后，计数为 5，应激活
    expect(trigger.shouldActivate("test-session")).toBe(true)
    // 激活后计数应重置为 0
    expect(trigger.getCounter("test-session")).toBe(0)
  })

  it("默认 everyNTurns 应为 30", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    // 激活 30 次
    for (let i = 0; i < 30; i++) {
      trigger.activate("session")
    }
    expect(trigger.shouldActivate("session")).toBe(true)
  })

  it("reset 应清空所有 session 的计数", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    trigger.activate("s1")
    trigger.activate("s1")
    trigger.activate("s2")
    trigger.reset()
    expect(trigger.getCounter("s1")).toBe(0)
    expect(trigger.getCounter("s2")).toBe(0)
  })

  it("未调用 activate 的 session shouldActivate 应返回 false", async () => {
    const { createSmithTrigger } = await import("../../src/hooks/smith-trigger")
    const trigger = createSmithTrigger()
    expect(trigger.shouldActivate("never-called")).toBe(false)
  })
})
