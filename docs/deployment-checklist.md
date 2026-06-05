# 部署检查清单

## 本地检查

```bash
npm install
npm run lint
npm run build
npm run dev
```

检查：
- 首页可打开
- 开始游戏可点击
- 水果会飞出
- 滑动可切水果
- 炸弹会扣分
- 60 秒后进入结算
- 最高分会保存

## GitHub

```bash
git init
git add .
git commit -m "Create watermelon ninja game skeleton"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

## Vercel

- Import Git Repository
- Framework Preset：Next.js
- Install Command：npm install
- Build Command：npm run build
- Output Directory：留空

## Codex 回报内容

- 是否 push 成功
- GitHub 仓库链接
- 当前 branch
- commit hash
- 是否还有未提交文件
- 是否 Vercel 部署成功
- Production URL
