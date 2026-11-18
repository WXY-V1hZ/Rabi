# 外部源码参考

外部源码仅供只读参考。依赖安装和构建只在 Rabi 自有项目中执行，业务代码从 pnpm 安装的包导入。仅在用户明确要求时更新 subtree，沿用 `--squash`，更新后运行 `pnpm check`。

## Effect

`effect/` 通过 Git subtree 导入 [Effect 官方仓库](https://github.com/Effect-TS/effect)，固定到与项目依赖一致的 `effect@4.1.4`。

- 编写或审查 Effect 代码前，先阅读 `effect/LLMS.md`，再按需查阅实现、测试和示例。
- 升级 Effect 依赖时同步更新 subtree，使用对应版本 tag，并更新本节的版本记录。

将 `VERSION_TAG` 替换为与依赖匹配的版本 tag，如 `effect@4.1.4`。

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git VERSION_TAG --squash -m "chore(effect): 更新 Effect 参考源码"
```

## effect-worker-mono

`effect-worker-mono/` 通过 Git subtree 导入 [effect-worker-mono](https://github.com/backpine/effect-worker-mono) 的 `main` 分支，供查阅 Effect 应用示例。

```bash
git subtree pull --prefix=repos/effect-worker-mono https://github.com/backpine/effect-worker-mono.git main --squash -m "chore: 更新 effect-worker-mono 参考源码"
```
