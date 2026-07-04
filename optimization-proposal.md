# xAgt 插件优化方案：面向个人开发者的代码质量约束

## 背景与目标

**用户场景**：个人开发者本地使用，读不懂代码，依赖 AI 生成代码。需要通过插件和规则约束 AI 行为，让产出更规范、可控、可维护。

**当前插件状态**：已实现三层行为约束（角色隔离、提示词铁律、任务看板），但主要约束开发流程，未约束代码质量。

**优化目标**：让 AI 生成的代码具有**可维护性**，包括规范的命名、清晰的结构、完整的注释、健壮的错误处理。

## 五个优化方向（作为独立 Skill）

### Skill 1：代码规范约束层 (code-rules)

**目标**：强制 AI 生成的代码符合统一规范

**加载方式**：Fixer 执行代码生成任务时自动加载

**核心规则**：
```yaml
naming:
  variables: "camelCase，有意义的名称"
  functions: "动词开头，如 getUserById"
  classes: "PascalCase，名词"
  files: "kebab-case，如 user-service.ts"
  
comments:
  functions: "必须添加 JSDoc 注释"
  complex_logic: "必须添加行内注释"
  todo: "必须标注 // TODO: 和预期解决方案"
  
structure:
  max_function_length: 50  # 行
  max_file_length: 300     # 行
  single_responsibility: true
  
error_handling:
  try_catch: "必须处理错误，禁止空 catch"
  error_messages: "必须包含上下文信息"
  logging: "必须使用统一日志函数"
```

**预期效果**：AI 生成的代码命名规范、注释完整、结构清晰。

### Skill 2：一致性保障 (consistency-guard)

**目标**：确保 AI 代码与项目现有风格一致

**加载方式**：Fixer 开始工作前加载，作为风格指南

**实现流程**：
1. Lynx 扫描项目现有代码，提取风格特征
2. 生成 `style-guide.json` 风格指南
3. Fixer 写代码前读取风格指南
4. 自动检测代码风格冲突

**风格指南维度**：
- 缩进（空格/Tab，数量）
- 引号（单引号/双引号）
- 分号（有/无）
- 导入顺序（分组规则）
- 类型定义（interface/type 选择）

**预期效果**：AI 代码与项目现有代码风格无缝融合。

### Skill 3：质量门禁 (quality-gate)

**目标**：自动检查代码质量，不合格则打回重做

**加载方式**：Fixer 完成代码修改后自动加载

**检查维度**：
```yaml
static_analysis:
  lint: "运行 eslint/prettier 检查"
  type_check: "运行 tsc --noEmit"
  
metrics:
  test_coverage: "新增代码覆盖率 >= 80%"
  complexity: "圈复杂度 <= 10"
  duplication: "代码重复率 <= 5%"
  
security:
  no_secrets: "禁止硬编码密钥"
  no_eval: "禁止使用 eval()"
  safe_regex: "避免正则表达式 ReDoS"
```

**工作流**：
1. Fixer 修改代码
2. 自动运行质量检查
3. 检查不通过 → 生成错误报告 → Fixer 修复
4. 检查通过 → 进入下一步

**预期效果**：AI 生成的代码自动通过质量门禁，减少人工审查负担。

### Skill 4：可维护性增强 (maintainability-booster)

**目标**：强制代码可维护性设计

**加载方式**：Fixer 进行架构设计或重构时加载

**核心规则**：
```yaml
modularization:
  max_file_size: "300 行，超过必须拆分"
  max_imports: "10 个，超过必须重构"
  
dependency_management:
  direction: "单向依赖，禁止循环"
  depth: "依赖深度 <= 5 层"
  
documentation:
  readme: "每个模块必须有 README.md"
  changelog: "重大变更必须更新 CHANGELOG"
  
refactoring:
  extract_function: "重复代码 >= 3 次必须提取"
  extract_component: "UI 重复 >= 3 次必须提取组件"
```

**预期效果**：AI 生成的代码模块化、低耦合、易扩展。

### Skill 5：智能代码审查 (ai-reviewer)

**目标**：引入独立审查 Agent，专门审查代码质量

**加载方式**：新增 `Reviewer` Agent，Fixer 完成任务后自动触发

**审查维度**：
```yaml
readability:
  naming: "变量/函数名是否清晰"
  comments: "注释是否充分"
  structure: "代码结构是否合理"
  
maintainability:
  coupling: "耦合度是否过高"
  cohesion: "内聚性是否足够"
  duplication: "是否有重复代码"
  
performance:
  algorithms: "算法复杂度是否合理"
  memory: "是否有内存泄漏风险"
  io: "是否有不必要的 IO 操作"
  
security:
  vulnerabilities: "是否有安全漏洞"
  input_validation: "输入验证是否充分"
  error_handling: "错误处理是否完善"
```

**工作流**：
1. Fixer 完成代码修改
2. 自动派 `@reviewer` 审查
3. 审查通过 → 完成
4. 审查不通过 → 生成问题清单 → Fixer 修复 → 重新审查

**预期效果**：代码经过双重检查，质量更有保障。

## 实施路径建议

### 阶段一：最小可行优化（1-2天）
- 在 Fixer 铁律中增加**代码规范规则**
- 不改架构，只改提示词
- 快速验证效果

### 阶段二：单点突破（3-5天）
- 实现 `code-rules` skill
- 实现 `consistency-guard` skill
- 集成到现有工作流

### 阶段三：完整方案（1-2周）
- 实现 `quality-gate` skill
- 实现 `maintainability-booster` skill
- 新增 `Reviewer` Agent

## 下一步行动

1. **立即执行**：在 Fixer 提示词中增加基础代码规范
2. **本周完成**：实现 `code-rules` skill 作为首个优化
3. **持续迭代**：根据使用效果逐步添加其他 skill

## 预期成果

通过这五个优化方向的实施，AI 生成的代码将：
- ✅ 命名规范、注释完整
- ✅ 风格与项目一致
- ✅ 自动通过质量检查
- ✅ 结构清晰、易维护
- ✅ 经过双重审查，质量可靠

最终目标：让个人开发者能够完全信任 AI 生成的代码，专注于业务逻辑而非代码质量。