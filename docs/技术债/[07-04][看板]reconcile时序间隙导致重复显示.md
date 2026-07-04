# [07-04][看板]reconcile时序间隙导致重复显示

## 状态
- [已解决]

## 优先级
- [中]

## 类别
- [前端：逻辑缺陷]

## 问题描述
主控AI（Vox）在子代理任务完成后，仍然说"后台看板挂着任务"。

**根本原因**：
1. `reconcileAll` 只在 `session.idle` 或 `session.status` 事件时触发
2. 看板注入发生在 `experimental.chat.messages.transform`（用户发送消息时）
3. 如果用户在任务完成后立即发送消息，`session.idle` 可能还没触发，看板会显示"已完成但未reconcile"的任务

## 影响范围
- 看板注入模块 `src/hooks/task-manager/index.ts`
- 影响所有使用子代理的场景

## 方案建议
在 `experimental.chat.messages.transform` 中，注入看板后立即调用 `reconcileAll` 和 `cleanReconciled`，避免后续重复显示。

## 实施记录
- 修改文件：`src/hooks/task-manager/index.ts`
- 修改内容：在 `experimental.chat.messages.transform` 末尾添加 reconcile 逻辑
- 测试结果：73个测试全部通过
