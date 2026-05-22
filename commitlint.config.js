export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // 新功能
        "fix",      // 修复 bug
        "docs",     // 文档
        "style",    // 代码格式（不影响功能）
        "refactor", // 重构
        "perf",     // 性能优化
        "test",     // 测试
        "build",    // 构建系统或外部依赖
        "ci",       // CI 配置
        "chore",    // 其他杂项
        "revert",   // 回滚
      ],
    ],
    "subject-case": [0],
  },
};
