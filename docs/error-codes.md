# Error Codes

| Code | Prefix | Module | Description |
|------|--------|--------|-------------|
| E1001 | FE::ERR  | gateway | agent_not_registered — sessionID 无法解析到任何已注册 xAgt agent |
| E1002 | FE::ERR  | gateway | policy_blocked — 工具调用被安全策略拦截 |
| E1003 | FE::ERR  | memory  | store_parse_failed — 记忆存储文件中有损坏的 JSONL 行 |
| E1004 | FE::ERR  | memory  | session_index_load_failed — 会话索引文件读取或解析失败 |
| E1005 | FE::ERR  | memory  | session_archive_load_failed — 单个会话存档文件读取失败 |
| E1006 | FE::ERR  | task    | task_state_save_failed — 任务状态文件写入失败 |
| E1007 | FE::ERR  | task    | task_state_load_failed — 任务状态文件读取或解析失败 |
| E2001 | FE::ERR  | memory  | store_corrupted — 记忆存储文件整体损坏，无法恢复 |
| E2002 | FE::ERR  | memory  | write_failed — 记忆写入失败（磁盘满或权限不足） |
| E3001 | FE::ERR  | sandbox | worktree_failed — Git worktree 操作失败 |
| E4001 | FE::ERR  | task    | state_corrupted — 任务状态文件整体损坏 |
| E5001 | FE::ERR  | plugin  | output_blocked — Vox 输出含代码但无 task() 被拦截 |
