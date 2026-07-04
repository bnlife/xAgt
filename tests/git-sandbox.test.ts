import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execSync } from "child_process"

// =========================================
// 测试辅助：在临时 Git 仓库中测试 SandboxManager
// =========================================
describe("SandboxManager", () => {
  let repoDir: string; let defaultBranch: string

  beforeAll(() => {
    repoDir = mkdtempSync(join(tmpdir(), "xagt-sandbox-test-"))
    execSync("git init", { cwd: repoDir })
    execSync('git config user.email "test@xagt.dev"', { cwd: repoDir })
    execSync('git config user.name "xAgt Test"', { cwd: repoDir })
    writeFileSync(join(repoDir, "README.md"), "# Test Repo\n")
    execSync("git add .", { cwd: repoDir })
    execSync("git commit -m init", { cwd: repoDir })

    // 检测默认分支名（可能是 main 或 master）
    defaultBranch = execSync(
      "git rev-parse --abbrev-ref HEAD",
      { cwd: repoDir, encoding: "utf-8" }
    ).trim()
  })

  afterAll(() => {
    // 先清理所有 worktree
    try {
      const out = execSync("git worktree list", { cwd: repoDir, encoding: "utf-8" })
      const lines = out.trim().split("\n").slice(1) // 跳过第一行（主仓库）
      for (const line of lines) {
        const wtPath = line.split(/\s+/)[0]
        if (wtPath) {
          try { execSync(`git worktree remove "${wtPath}"`, { cwd: repoDir }) } catch {}
        }
      }
    } catch {}
    // 删除残留分支
    try {
      execSync(`git checkout ${defaultBranch}`, { cwd: repoDir })
      const branches = execSync("git branch --list 'ai/task-*'", { cwd: repoDir, encoding: "utf-8" })
      for (const b of branches.trim().split("\n")) {
        if (b.trim()) {
          try { execSync(`git branch -D "${b.trim()}"`, { cwd: repoDir }) } catch {}
        }
      }
    } catch {}
    rmSync(repoDir, { recursive: true, force: true })
  })

  // =========================================
  // 测试 1：创建 worktree
  // =========================================
  it("createSandbox 应创建 worktree 目录和独立分支", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const manager = new SandboxManager({ repoDir })
    const info = await manager.createSandbox("test-001")

    try {
      // worktree 目录存在
      expect(existsSync(info.worktreePath)).toBe(true)
      // branch 命名正确
      expect(info.branchName).toMatch(/^ai\/task-test-001/)
      expect(info.taskID).toBe("test-001")

      // worktree 目录内有 README.md（从 HEAD checkout）
      expect(existsSync(join(info.worktreePath, "README.md"))).toBe(true)

      // 当前分支确实是独立分支（不是 main）
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: info.worktreePath,
        encoding: "utf-8",
      }).trim()
      expect(branch).toMatch(/^ai\/task-test-001/)
    } finally {
      await manager.removeSandbox(info)
    }
  })

  // =========================================
  // 测试 2：getChanges 检测变更
  // =========================================
  it("getChanges 应返回 worktree 中的变更文件列表", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const manager = new SandboxManager({ repoDir })
    const info = await manager.createSandbox("test-002")

    try {
      // 在 worktree 中创建新文件和修改已有文件
      writeFileSync(join(info.worktreePath, "new-file.ts"), "// new file\n")
      writeFileSync(join(info.worktreePath, "README.md"), "# Modified Repo\n")

      const changes = await manager.getChanges(info)
      expect(changes).toContain("new-file.ts")
      expect(changes).toContain("README.md")
      expect(changes.length).toBeGreaterThanOrEqual(2)
    } finally {
      await manager.removeSandbox(info)
    }
  })

  // =========================================
  // 测试 3：mergeToMain 合并变更回主线
  // =========================================
  it("mergeToMain 应将 worktree 的变更合并到主线", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const manager = new SandboxManager({ repoDir })
    const info = await manager.createSandbox("test-003")

    try {
      // 在 worktree 中修改文件
      writeFileSync(join(info.worktreePath, "README.md"), "# Modified for merge test\n")

      // 合并到主线
      await manager.mergeToMain(info, "feat: test merge")

      // 验证主线已经包含修改
      const mainReadme = readFileSync(join(repoDir, "README.md"), "utf-8")
      expect(mainReadme).toContain("Modified for merge test")

      // 验证 git log 中有合并记录
      const log = execSync("git log --oneline -5", { cwd: repoDir, encoding: "utf-8" })
      expect(log).toContain("feat: test merge")
    } finally {
      // 清理残留分支（merge 后分支已被合并删除）
      try {
        await manager.removeSandbox(info)
      } catch {}
    }
  })

  // =========================================
  // 测试 4：mergeToMain 无变更时应自动跳过提交
  // =========================================
  it("mergeToMain 无变更时不应创建空提交", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const manager = new SandboxManager({ repoDir })
    const info = await manager.createSandbox("test-004")

    try {
      // 不修改任何文件，直接合并
      await manager.mergeToMain(info, "chore: empty")

      // 验证主线没有新提交
      const log = execSync("git log --oneline -3", { cwd: repoDir, encoding: "utf-8" })
      expect(log).not.toContain("chore: empty")
    } finally {
      try { await manager.removeSandbox(info) } catch {}
    }
  })

  // =========================================
  // 测试 5：removeSandbox 清理 worktree
  // =========================================
  it("removeSandbox 应删除 worktree 目录", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const manager = new SandboxManager({ repoDir })
    const info = await manager.createSandbox("test-005")

    expect(existsSync(info.worktreePath)).toBe(true)
    await manager.removeSandbox(info)
    expect(existsSync(info.worktreePath)).toBe(false)

    // worktree 列表不应包含该路径
    const list = execSync("git worktree list", { cwd: repoDir, encoding: "utf-8" })
    expect(list).not.toContain(info.worktreePath)
  })

  // =========================================
  // 测试 6：多次创建 worktree 应有不同名称
  // =========================================
  it("连续创建多个 worktree 应互不干扰", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const manager = new SandboxManager({ repoDir })
    const info1 = await manager.createSandbox("multi-001")
    const info2 = await manager.createSandbox("multi-002")

    try {
      expect(info1.worktreePath).not.toBe(info2.worktreePath)
      expect(info1.branchName).not.toBe(info2.branchName)

      // 两个 worktree 都可用
      writeFileSync(join(info1.worktreePath, "file-a.ts"), "// a\n")
      writeFileSync(join(info2.worktreePath, "file-b.ts"), "// b\n")

      const changes1 = await manager.getChanges(info1)
      expect(changes1).toContain("file-a.ts")
      expect(changes1).not.toContain("file-b.ts")

      const changes2 = await manager.getChanges(info2)
      expect(changes2).toContain("file-b.ts")
      expect(changes2).not.toContain("file-a.ts")
    } finally {
      await manager.removeSandbox(info1)
      await manager.removeSandbox(info2)
    }
  })
})

// =========================================
// 安全测试：边界输入和注入防护
// =========================================
describe("SandboxManager 安全", () => {
  it("特殊字符 taskID 应被消毒（空格和特殊符号替换为下划线）", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const { mkdtempSync, rmSync, existsSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-sandbox-security-"))
    try {
      execSync("git init", { cwd: isolatedDir })
      execSync('git config user.email "test@xagt.dev"', { cwd: isolatedDir })
      execSync('git config user.name "xAgt Test"', { cwd: isolatedDir })
      writeFileSync(join(isolatedDir, "README.md"), "# Test\n")
      execSync("git add .", { cwd: isolatedDir })
      execSync("git commit -m init", { cwd: isolatedDir })

      const manager = new SandboxManager({ repoDir: isolatedDir })
      // taskID 包含空格和特殊字符
      const info = await manager.createSandbox("hello world & rm -rf")
      try {
        // 消毒后不应包含空格或特殊字符
        expect(info.branchName).not.toContain(" ")
        expect(info.branchName).not.toContain("&")
        expect(info.branchName).toMatch(/^ai\/task-/)
        expect(existsSync(info.worktreePath)).toBe(true)
      } finally {
        await manager.removeSandbox(info)
      }
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("路径穿越 taskID \"../evil\" 应被拦截", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-sandbox-ptrav-"))
    try {
      execSync("git init", { cwd: isolatedDir })
      execSync('git config user.email "test@xagt.dev"', { cwd: isolatedDir })
      execSync('git config user.name "xAgt Test"', { cwd: isolatedDir })
      writeFileSync(join(isolatedDir, "README.md"), "# Test\n")
      execSync("git add .", { cwd: isolatedDir })
      execSync("git commit -m init", { cwd: isolatedDir })

      const manager = new SandboxManager({ repoDir: isolatedDir })
      const info = await manager.createSandbox("../evil")
      try {
        // 消毒后 "../evil" → "___evil"（两个点+斜杠=三个下划线）
        expect(info.branchName).toBe("ai/task-___evil")
        // worktreePath 应该在沙盒目录内
        expect(info.worktreePath).toContain(".xagt\\sandbox\\")
        expect(info.worktreePath).not.toContain("..")
      } finally {
        await manager.removeSandbox(info)
      }
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it("空 taskID 应创建名称为 \"ai/task-\" 的分支", async () => {
    const { SandboxManager } = await import("../src/git-sandbox")
    const { mkdtempSync, rmSync } = await import("fs")
    const { join } = await import("path")
    const { tmpdir } = await import("os")
    const isolatedDir = mkdtempSync(join(tmpdir(), "xagt-sandbox-empty-"))
    try {
      execSync("git init", { cwd: isolatedDir })
      execSync('git config user.email "test@xagt.dev"', { cwd: isolatedDir })
      execSync('git config user.name "xAgt Test"', { cwd: isolatedDir })
      writeFileSync(join(isolatedDir, "README.md"), "# Test\n")
      execSync("git add .", { cwd: isolatedDir })
      execSync("git commit -m init", { cwd: isolatedDir })

      const manager = new SandboxManager({ repoDir: isolatedDir })
      const info = await manager.createSandbox("")
      try {
        expect(info.branchName).toBe("ai/task-")
        expect(info.worktreePath).toBe(
          join(isolatedDir, ".xagt", "sandbox", "")
        )
      } finally {
        await manager.removeSandbox(info)
      }
    } finally {
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })
})
