/**
 * Memory Store — 文件存储引擎
 *
 * 基于 JSONL（JSON Lines）格式的持久化存储。
 * 零依赖，自动轮转，优雅处理损坏数据。
 */

import { readFile, mkdir, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { join, dirname } from "path"
import { XAGT_DIR, MEMORY_FILE } from "../constants"

export type MemoryType = "lesson" | "pattern" | "decision"

export interface MemoryRecord {
  type: MemoryType
  /** ISO 8601 时间戳，自动生成 */
  timestamp: string
  content: string
}

export interface MemoryQuery {
  /** 最大返回数，默认 20 */
  limit?: number
  /** 按类型过滤 */
  type?: MemoryType
  /** 只返回此时间戳之后的记录 */
  since?: string
}

export interface MemoryStats {
  total: number
  byType: Record<string, number>
}

export class MemoryStore {
  static readonly MAX_RECORDS = 200
  static readonly DEFAULT_LIMIT = 20

  private filePath: string
  /** 串行化 append 操作的 promise 链，防止并发写入冲突 */
  private appendQueue: Promise<void> = Promise.resolve()

  /**
   * @param storageDir 存储目录，默认 .xagt/
   */
  constructor(storageDir?: string) {
    const dir = storageDir ?? join(process.cwd(), XAGT_DIR)
    this.filePath = join(dir, MEMORY_FILE)
  }

  /**
   * 确保存储目录和文件存在。
   */
  private async ensureFile(): Promise<void> {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    if (!existsSync(this.filePath)) {
      await writeFile(this.filePath, "", "utf-8")
    }
  }

  /**
   * 追加一条记忆记录。自动填充时间戳。
   * 如果超出上限，自动裁剪最旧的记录。
   */
  async append(record: Omit<MemoryRecord, "timestamp">): Promise<void> {
    // 串行化：排队等待前一个 append 完成
    let release: (() => void) | undefined
    const next = new Promise<void>(r => { release = r })
    const prev = this.appendQueue
    this.appendQueue = next
    await prev

    try {
      await this.ensureFile()

      const records = await this.readAll()

      // 生成单调递增时间戳，同一毫秒内自动 +1ms 以区分先后
      let timestamp = new Date(Date.now()).toISOString()
      if (records.length > 0) {
        const lastTs = records[records.length - 1].timestamp
        if (timestamp <= lastTs) {
          timestamp = new Date(new Date(lastTs).getTime() + 1).toISOString()
        }
      }

      const full: MemoryRecord = {
        ...record,
        timestamp,
      }

      // 读取全部 → 追加 → 裁剪 → 一次性写回（消除 TOCTOU 竞态）
      records.push(full)

      // 按时间倒序，保留最新的 MAX_RECORDS 条
      records.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      const kept = records.slice(0, MemoryStore.MAX_RECORDS)

      // 写回文件（按时间升序，保持可读性）
      kept.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      const lines = kept.map(r => JSON.stringify(r)).join("\n") + "\n"
      await writeFile(this.filePath, lines, "utf-8")
    } finally {
      release?.()
    }
  }

  /**
   * 查询记忆记录。按时间倒序排列（最新在前）。
   */
  async query(options?: MemoryQuery): Promise<MemoryRecord[]> {
    const limit = options?.limit ?? MemoryStore.DEFAULT_LIMIT
    const records = await this.readAll()

    let filtered = records

    // 按类型过滤
    if (options?.type) {
      filtered = filtered.filter(r => r.type === options.type)
    }

    // 按时间过滤
    if (options?.since) {
      const since = options.since
      filtered = filtered.filter(r => r.timestamp >= since)
    }

    // 按时间倒序（最新在前）
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    // 限制数量
    return filtered.slice(0, limit)
  }

  /**
   * 如果记录数超出上限，裁剪到 MAX_RECORDS。
   * 保留最新的记录，删除最旧的。
   * @returns 删除的记录数
   */
  async rollover(maxRecords?: number): Promise<number> {
    const max = maxRecords ?? MemoryStore.MAX_RECORDS
    const records = await this.readAll()

    if (records.length <= max) return 0

    // 按时间倒序排列
    records.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    // 保留最新的 max 条
    const kept = records.slice(0, max)
    const deleted = records.length - kept.length

    // 重写文件
    const lines = kept.map(r => JSON.stringify(r)).join("\n") + "\n"
    await writeFile(this.filePath, lines, "utf-8")

    return deleted
  }

  /**
   * 获取统计信息：总记录数和按类型分布。
   */
  async getStats(): Promise<MemoryStats> {
    const records = await this.readAll()
    const byType: Record<string, number> = {}

    for (const r of records) {
      byType[r.type] = (byType[r.type] ?? 0) + 1
    }

    return { total: records.length, byType }
  }

  /**
   * 读取全部记录（保留原始顺序，不做排序）。
   * 损坏的行被跳过不报错。
   */
  private async readAll(): Promise<MemoryRecord[]> {
    if (!existsSync(this.filePath)) return []

    const content = await readFile(this.filePath, "utf-8")
    const lines = content.split("\n").filter(line => line.trim() !== "")

    const records: MemoryRecord[] = []
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed && parsed.type && parsed.timestamp && parsed.content) {
          records.push(parsed as MemoryRecord)
        }
      } catch {
        // 跳过损坏的行
      }
    }

    return records
  }

}
