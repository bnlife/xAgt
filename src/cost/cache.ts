import { logger } from "../utils/logger"

/**
 * Tool Result Cache — 工具调用结果缓存
 *
 * 缓存只读 Agent（Lynx/Judge/Smith）的幂等工具调用结果。
 * 减少重复 LLM 调用，降低延迟和成本。
 *
 * 缓存策略：
 * - LRU 淘汰（超上限时淘汰最旧）
 * - TTL 过期（按类型不同）
 * - 前缀批量失效（文件修改时清除相关缓存）
 */

interface CacheEntry<T = any> {
  value: T
  expiresAt: number
  createdAt: number
}

interface CacheOptions {
  ttlMs?: number
  maxEntries?: number
}

interface CacheStats {
  size: number
  oldest: number
  newest: number
}

const DEFAULT_TTL_MS = 30_000 // 30s
const DEFAULT_MAX_ENTRIES = 100

class ToolResultCacheImpl {
  private store = new Map<string, CacheEntry>()
  private accessOrder: string[] = []

  private get defaultOptions(): CacheOptions {
    return { ttlMs: DEFAULT_TTL_MS, maxEntries: DEFAULT_MAX_ENTRIES }
  }

  set(key: string, value: any, options?: CacheOptions): void {
    const opts = { ...this.defaultOptions, ...options }
    const now = Date.now()

    logger.debug("cost::cache::set", "set", { key, ttl: opts.ttlMs })

    // 淘汰：如果已存在，先删
    if (this.store.has(key)) {
      this.store.delete(key)
      this.accessOrder = this.accessOrder.filter(k => k !== key)
    }

    // 淘汰：超过最大条目
    while (this.store.size >= (opts.maxEntries ?? DEFAULT_MAX_ENTRIES)) {
      const oldest = this.accessOrder.shift()
      if (oldest !== undefined) {
        this.store.delete(oldest)
        logger.warn("cost::cache::set", "evict", { key: oldest })
      } else {
        break
      }
    }

    this.store.set(key, {
      value,
      expiresAt: now + (opts.ttlMs ?? DEFAULT_TTL_MS),
      createdAt: now,
    })
    this.accessOrder.push(key)
  }

  get<T = any>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) {
      logger.debug("cost::cache::get", "miss", { key })
      return undefined
    }

    // 检查 TTL
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.accessOrder = this.accessOrder.filter(k => k !== key)
      logger.debug("cost::cache::get", "miss", { key })
      return undefined
    }

    logger.debug("cost::cache::get", "hit", { key })

    // 更新访问顺序（LRU）
    this.accessOrder = this.accessOrder.filter(k => k !== key)
    this.accessOrder.push(key)

    return entry.value as T
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
        this.accessOrder = this.accessOrder.filter(k => k !== key)
      }
    }
  }

  clear(): void {
    this.store.clear()
    this.accessOrder = []
  }

  getStats(): CacheStats {
    let oldest = Infinity
    let newest = 0
    for (const entry of this.store.values()) {
      if (entry.createdAt < oldest) oldest = entry.createdAt
      if (entry.createdAt > newest) newest = entry.createdAt
    }
    return {
      size: this.store.size,
      oldest: oldest === Infinity ? 0 : oldest,
      newest,
    }
  }
}

export const ToolResultCache = new ToolResultCacheImpl()
