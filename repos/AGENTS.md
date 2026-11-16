# 外部源码参考

`effect/` 通过 Git subtree 导入 [Effect 官方仓库](https://github.com/Effect-TS/effect)，固定到与项目依赖一致的 `effect@4.1.4`。

- 编写或审查 Effect 代码前，先阅读 `effect/LLMS.md`，再按需查阅实现、测试和示例。
- 外部源码仅供只读参考；仅在用户明确要求更新时改动。业务代码继续从 pnpm 安装的包导入，不直接引用本目录，也不在此安装依赖或运行构建。
- 升级 Effect 依赖时同步更新 subtree，使用对应版本 tag，保持 `--squash`；更新后核对本文件的版本，并运行项目检查。

更新命令（将 `<tag>` 替换为与依赖匹配的版本，如 `effect@4.1.4`）：

```bash
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git <tag> --squash -m "chore(effect): 更新 Effect 参考源码"
```
