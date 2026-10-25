# 李奕洲 / Ian

本地个人网站。电脑开着、并且已经登录时，它会停在 [http://127.0.0.1:8090](http://127.0.0.1:8090)。进程挂了会被拉起来；下次登录会自己启动。做法和《争斗校花》那套 keep-alive 一样。

## 常用命令

```bash
npm run autostart:install
npm run autostart:uninstall
npm start
```

`autostart:install` 会登记登录任务，并立刻把站点拉起来。关掉 keep-alive 窗口不会关掉网站。要停掉站点，先卸载自启，再在任务管理器里结束对应的 `node.exe`。

日志在 `logs/keep-alive.log`。

## 改文案

中英两套都在 `content/copy.json`。页面上的中文是兜底，打开后会按这份文件重写。语言按钮在右上角，选择会记在这台浏览器里。

右上角「简历 PDF」按当前语言排一版简历并下载。它用本机 Edge 把 `/resume` 打成 PDF，不是另一份手写文件。

## 页面

关于、经历、教育、能力来自 2026-04-12 的简历。高并发项目、桌游和《争斗校花》在「其他」里。游戏公网地址是 https://lyz-school-battle.ggff.net/ 。

电话是 +86 185 7693 0287。
