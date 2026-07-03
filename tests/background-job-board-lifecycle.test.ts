/**
 * BackgroundJobBoard 生命周期 E2E 测试
 *
 * 覆盖全状态流转：
 * launch → running
 * running → complete → terminal_unreconciled
 * running → fail → terminal_unreconciled
 * running → cancel → terminal_unreconciled
 * terminal_unreconciled → markReconciled → reconciled
 * terminal_unreconciled → reconcileAll → reconciled → cleanReconciled → 已删除
 * getActive 只返回 running + terminal_unreconciled
 * 对不存在的 id 操作不报错
 */
import { describe, it, expect } from "bun:test"
import { BackgroundJobBoard } from "../src/utils/background-job-board"

describe("BackgroundJobBoard 完整生命周期", () => {
  // ── launch → running ──
  it("launch 后状态为 running", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    const r = board.get("t1")
    expect(r).toBeDefined()
    expect(r!.state).toBe("running")
    expect(r!.agent).toBe("lynx")
    expect(r!.prompt).toBe("查一下")
    expect(r!.startedAt).toBeGreaterThan(0)
  })

  // ── running → complete → terminal_unreconciled ──
  it("complete 后状态为 terminal_unreconciled", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    board.complete("t1", "找到了")
    const r = board.get("t1")
    expect(r!.state).toBe("terminal_unreconciled")
    expect(r!.resultSummary).toBe("找到了")
    expect(r!.completedAt).toBeGreaterThan(0)
  })

  // ── running → fail → terminal_unreconciled ──
  it("fail 后状态为 terminal_unreconciled", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    board.fail("t1", "出错啦")
    const r = board.get("t1")
    expect(r!.state).toBe("terminal_unreconciled")
    expect(r!.resultSummary).toBe("出错啦")
  })

  // ── running → cancel → terminal_unreconciled ──
  it("cancel 后状态为 terminal_unreconciled", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    board.cancel("t1")
    const r = board.get("t1")
    expect(r!.state).toBe("terminal_unreconciled")
  })

  // ── terminal_unreconciled → markReconciled → reconciled ──
  it("markReconciled 后状态为 reconciled", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    board.complete("t1", "ok")
    board.markReconciled("t1")
    expect(board.get("t1")!.state).toBe("reconciled")
  })

  // ── markReconciled 对非 terminal_unreconciled 无效 ──
  it("markReconciled 对 running 任务无效", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    const ok = board.markReconciled("t1")
    expect(ok).toBe(false)
    expect(board.get("t1")!.state).toBe("running")
  })

  // ── terminal_unreconciled → reconcileAll → reconciled → cleanReconciled → 已删除 ──
  it("reconcileAll + cleanReconciled 完整清理链", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })
    board.complete("t1", "ok")
    board.launch("t2", { agent: "fixer", prompt: "改代码" })
    board.complete("t2", "done")

    // reconcileAll 将所有 terminal_unreconciled 转 reconciled
    const reconciled = board.reconcileAll()
    expect(reconciled).toBe(2)
    expect(board.get("t1")!.state).toBe("reconciled")
    expect(board.get("t2")!.state).toBe("reconciled")

    // cleanReconciled 删除所有 reconciled
    const cleaned = board.cleanReconciled()
    expect(cleaned).toBe(2)
    expect(board.get("t1")).toBeUndefined()
    expect(board.get("t2")).toBeUndefined()
  })

  // ── reconcileAll 只处理 terminal_unreconciled，不碰 running ──
  it("reconcileAll 不碰 running 任务", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" }) // running
    board.launch("t2", { agent: "fixer", prompt: "改代码" })
    board.complete("t2", "done") // terminal_unreconciled

    const n = board.reconcileAll()
    expect(n).toBe(1) // 只 reconcile 了 t2
    expect(board.get("t1")!.state).toBe("running")
  })

  // ── getActive 只返回 running + terminal_unreconciled ──
  it("getActive 只返回 running 和 terminal_unreconciled", () => {
    const board = new BackgroundJobBoard()
    board.launch("t1", { agent: "lynx", prompt: "查一下" })          // running
    board.launch("t2", { agent: "fixer", prompt: "改代码" })
    board.complete("t2", "done")                                       // terminal_unreconciled
    board.launch("t3", { agent: "vox", prompt: "规划" })
    board.complete("t3", "planned")
    board.markReconciled("t3")                                          // reconciled

    const active = board.getActive()
    expect(active.length).toBe(2) // t1 + t2
    expect(active.find(r => r.id === "t1")).toBeDefined()
    expect(active.find(r => r.id === "t2")).toBeDefined()
    expect(active.find(r => r.id === "t3")).toBeUndefined()
  })

  // ── 对不存在的 id 操作不报错 ──
  it("对不存在的 id 操作返回 undefined/false", () => {
    const board = new BackgroundJobBoard()
    expect(board.get("nonexist")).toBeUndefined()
    expect(board.complete("nonexist", "x")).toBeUndefined()
    expect(board.fail("nonexist", "x")).toBeUndefined()
    expect(board.cancel("nonexist")).toBeUndefined()
    expect(board.markReconciled("nonexist")).toBe(false)
  })

  // ── 空板子 getActive 返回空数组 ──
  it("空板子 getActive 返回空数组", () => {
    const board = new BackgroundJobBoard()
    expect(board.getActive()).toEqual([])
  })

  // ── 空板子 cleanReconciled 返回 0 ──
  it("空板子 cleanReconciled 返回 0", () => {
    const board = new BackgroundJobBoard()
    expect(board.cleanReconciled()).toBe(0)
  })

  // ── reconcileAll 空板子返回 0 ──
  it("空板子 reconcileAll 返回 0", () => {
    const board = new BackgroundJobBoard()
    expect(board.reconcileAll()).toBe(0)
  })
})
