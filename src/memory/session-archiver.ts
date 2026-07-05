/**
 * Session Archiver — 对话存档
 * 
 * 在 chat.message 中增量保存对话内容，自动编号+标题。
 * 在 system.transform 中注入最近对话摘要供 Vox 参考。
 * 
 * 存储位置：.xagt/sessions/
 * 格式：S编号-标题.json（完整对话）+ sessions.json（索引）
 */

import { join } from "path"
import { existsSync } from "fs"
import { readFile, mkdir, writeFile } from "fs/promises"
import { XAGT_DIR } from "../constants"
import { logger } from "../utils/logger"

export interface SessionIndexEntry {
  number: string        // "S001"
  title: string
  filename: string
  sessionID: string
  created_at: string
  message_count: number
}

interface SessionIndex {
  sessions: SessionIndexEntry[]
}

interface SessionArchive {
  number: string
  title: string
  sessionID: string
  created_at: string
  updated_at: string
  message_count: number
  messages: any[]
}

export class SessionArchiver {
  private sessionsDir: string
  private indexPath: string
  private seenIDs = new Set<string>()

  constructor(storageDir?: string) {
    const base = storageDir ?? join(process.cwd(), XAGT_DIR)
    this.sessionsDir = join(base, "sessions")
    this.indexPath = join(this.sessionsDir, "sessions.json")
  }

  private async ensureDir() {
    if (!existsSync(this.sessionsDir)) {
      await mkdir(this.sessionsDir, { recursive: true })
    }
  }

  private async loadIndex(): Promise<SessionIndex> {
    await this.ensureDir()
    try {
      return JSON.parse(await readFile(this.indexPath, "utf-8"))
    } catch (e) {
      logger.error("memory::session::loadIndex", "load_failed", { error: String(e) }, "E1004")
      return { sessions: [] }
    }
  }

  private async saveIndex(index: SessionIndex) {
    await this.ensureDir()
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf-8")
  }

  private nextNumber(index: SessionIndex): string {
    const last = index.sessions[index.sessions.length - 1]
    if (!last) return "S001"
    const num = parseInt(last.number.slice(1)) + 1
    return `S${String(num).padStart(3, "0")}`
  }

  private generateTitle(content: any): string {
    const text = typeof content === "string" ? content
      : content?.content?.[0]?.text || content?.text || content?.content || ""
    const cleaned = String(text).replace(/[\n\r]/g, " ").trim()
    return cleaned.slice(0, 30) || "unnamed_session"
  }

  private sanitize(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_")
  }

  /** 追加一条消息到存档（chat.message 中增量调用） */
  async appendMessage(sessionID: string, message: any) {
    await this.ensureDir()
    const index = await this.loadIndex()

    let entry = index.sessions.find(s => s.sessionID === sessionID)
    if (!entry) {
      const number = this.nextNumber(index)
      const title = this.generateTitle(message)
      entry = {
        number,
        title,
        filename: `${number}-${this.sanitize(title)}.json`,
        sessionID,
        created_at: new Date().toISOString(),
        message_count: 0,
      }
      index.sessions.push(entry)
      logger.info("memory::session::append", "new_session", { number: entry.number, title: entry.title })
    }

    entry.message_count += 1
    logger.debug("memory::session::append", "appended", { number: entry.number, msgCount: entry.message_count })

    const filePath = join(this.sessionsDir, entry.filename)
    let archive: SessionArchive
    try {
      archive = JSON.parse(await readFile(filePath, "utf-8"))
    } catch (e) {
      logger.error("memory::session::append", "load_archive_failed", { error: String(e), filePath }, "E1005")
      archive = { number: entry.number, title: entry.title, sessionID, created_at: entry.created_at, updated_at: "", message_count: 0, messages: [] }
    }

    archive.messages.push(message)
    archive.message_count = entry.message_count
    archive.updated_at = new Date().toISOString()

    await writeFile(filePath, JSON.stringify(archive, null, 2), "utf-8")
    await this.saveIndex(index)
  }

  /** 获取最近 N 场对话的摘要（用于 system.transform 注入） */
  async getRecentSummary(limit = 5): Promise<string> {
    const index = await this.loadIndex()
    const recent = index.sessions.slice(-limit)
    if (recent.length === 0) return ""
    logger.debug("memory::session::query", "recent", { count: recent.length })
    return recent.map(s => `- ${s.number} ${s.title} | ${s.message_count} msgs`).join("\n")
  }
}
