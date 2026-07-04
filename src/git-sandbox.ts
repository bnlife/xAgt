/**
 * Git Sandbox — Git Worktree 沙盒管理
 *
 * 为每个任务创建独立的 Git Worktree 沙盒环境。
 * Fixer 在沙盒中修改代码，Judge 审查通过后合并回主线。
 */

import { execSync } from "child_process"
import { existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { XAGT_DIR, SANDBOX_DIR } from "./constants"

export interface SandboxInfo {
  worktreePath: string
  branchName: string
  taskID: string
}

export interface SandboxOptions {
  /** Git 仓库根目录，默认 process.cwd() */
  repoDir?: string
  /** 沙盒存放目录，默认 .xagt/sandbox/ */
  sandboxDir?: string
}

export class SandboxManager {
  private repoDir: string
  private sandboxDir: string

  constructor(options?: SandboxOptions) {
    this.repoDir = options?.repoDir ?? process.cwd()
    this.sandboxDir = options?.sandboxDir ?? join(this.repoDir, XAGT_DIR, SANDBOX_DIR)
  }

  /**
   * 执行 Git 命令。
   */
  private git(args: string[], cwd?: string): string {
    // 对含空格的参数加引号，避免 shell 拆分
    const quoted = args.map(a => /[\s()"]/.test(a) ? `"${a.replace(/"/g, "'")}"` : a)
    const cmd = `git ${quoted.join(" ")}`
    const result = execSync(cmd, {
      cwd: cwd ?? this.repoDir,
      encoding: "utf-8",
    })
    return result.trim()
  }

  /**
   * 消毒 taskID：只允许字母、数字、连字符、下划线。
   * 防止命令注入和路径穿越。
   */
  private sanitizeTaskID(taskID: string): string {
    return taskID.replace(/[^a-zA-Z0-9_-]/g, "_")
  }

  /**
   * 创建沙盒 worktree。
   *
   * 1. 在 .xagt/sandbox/{taskID}/ 创建 worktree
   * 2. 分支名为 ai/task-{taskID}
   * 3. 从当前 HEAD 创建
   *
   * @param taskID 任务标识（用于分支名和目录名）
   */
  async createSandbox(taskID: string): Promise<SandboxInfo> {
    taskID = this.sanitizeTaskID(taskID)  // 消毒
    const branchName = `ai/task-${taskID}`
    const worktreePath = join(this.sandboxDir, taskID)

    // 确保沙盒目录存在
    if (!existsSync(this.sandboxDir)) {
      mkdirSync(this.sandboxDir, { recursive: true })
    }

    // 如果 worktree 已存在，先清理
    if (existsSync(worktreePath)) {
      console.log(`[xAgt] cleanup stale worktree | path=${worktreePath} task=${taskID}`)
      try {
        this.git(["worktree", "remove", "--force", worktreePath])
      } catch {}
      try {
        this.git(["branch", "-D", branchName])
      } catch {}
      rmSync(worktreePath, { recursive: true, force: true })
    }

    // 创建 worktree，自动创建新分支
    this.git(["worktree", "add", "-b", branchName, worktreePath, "HEAD"])

    return { worktreePath, branchName, taskID }
  }

  /**
   * 获取沙盒中的变更文件列表（相对路径）。
   *
   * @param info 沙盒信息
   */
  async getChanges(info: SandboxInfo): Promise<string[]> {
    const status = this.git(["status", "--porcelain"], info.worktreePath)
    if (!status) return []

    const lines = status.split("\n").filter(line => line.trim())
    return lines.map(line => {
      // 格式: "?? new-file.ts" 或 " M modified-file.ts"
      const parts = line.trim().split(/\s+/, 2)
      return parts[parts.length - 1]
    })
  }

  /**
   * 将沙盒变更合并到主线。
   *
   * 流程：
   * 1. 在沙盒中 git add + commit
   * 2. 回到主线 merge 沙盒分支
   * 3. 删除沙盒分支
   *
   * 如果没有变更，自动跳过不创建空提交。
   *
   * @param info 沙盒信息
   * @param message 提交信息（可选，自动生成）
   */
  async mergeToMain(info: SandboxInfo, message?: string): Promise<void> {
    const status = this.git(["status", "--porcelain"], info.worktreePath)
    if (!status.trim()) {
      return // 无变更，跳过
    }

    const commitMsg = message ?? `feat(sandbox): ${info.taskID}`

    // 在沙盒中提交
    this.git(["add", "."], info.worktreePath)
    this.git(["commit", "-m", commitMsg], info.worktreePath)

    // 获取当前分支
    const prevBranch = this.git(["rev-parse", "--abbrev-ref", "HEAD"])

    try {
      // 合并沙盒分支到当前分支
      this.git(["merge", info.branchName, "--no-edit"])
    } catch (e) {
      // 合并冲突，安全回退
      this.git(["merge", "--abort"])
      if (prevBranch && prevBranch !== "HEAD") {
        this.git(["checkout", prevBranch])
      }
      const originalMsg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `sandbox merge conflict: branch "${info.branchName}" cannot merge into "${prevBranch}". Original error: ${originalMsg}`
      )
    }

    // 删除沙盒分支
    try {
      this.git(["branch", "-d", info.branchName])
    } catch {
      // 分支可能已被其他操作删除
    }
  }

  /**
   * 移除沙盒 worktree。
   *
   * @param info 沙盒信息
   */
  async removeSandbox(info: SandboxInfo): Promise<void> {
    // 路径边界检查：防止误删沙盒外目录
    const normalizedWt = join(info.worktreePath)
    const normalizedSb = join(this.sandboxDir)
    if (!normalizedWt.startsWith(normalizedSb)) {
      throw new Error(
        `sandbox path boundary violation: "${info.worktreePath}" is not within "${this.sandboxDir}"`
      )
    }

    try {
      this.git(["worktree", "remove", info.worktreePath])
    } catch {
      // 如果有未提交变更，强制删除
      this.git(["worktree", "remove", "--force", info.worktreePath])
    }

    // 清理分支
    try {
      this.git(["branch", "-D", info.branchName])
    } catch {}

    // 清理目录
    if (existsSync(info.worktreePath)) {
      rmSync(info.worktreePath, { recursive: true, force: true })
    }
  }
}
