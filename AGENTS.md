# AGENTS.md｜Codex 执行总规则

项目名称：西瓜忍者｜60秒挑战
目标：把当前骨架继续开发成一个可部署到 Vercel 的手机网页小游戏。

---

## 1. 技术栈固定

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Client Component
- 不接后端
- 不接数据库
- 最高分使用 localStorage
- 部署平台：Vercel

禁止：
- 不要引入复杂游戏引擎，例如 Phaser、Pixi、Three.js，除非用户明确要求。
- 不要改成 Vue、Vite、纯 HTML 项目。
- 不要加入登录系统。
- 不要加入付费系统。

---

## 2. 游戏核心规则

游戏名称：西瓜忍者｜60秒挑战

玩法：
1. 玩家点击「开始游戏」。
2. 进入 60 秒挑战。
3. 水果从屏幕底部随机飞出，带抛物线运动。
4. 玩家用鼠标或手指滑动切水果。
5. 滑动轨迹碰到水果，水果消失并加分。
6. 滑动轨迹碰到炸弹，扣 5 分。
7. 时间结束进入结算页。
8. 如果本次分数高于历史最高分，更新 localStorage。

计分：
- 普通水果：+1
- 单次滑动切中 2 个水果：总计 +3
- 单次滑动切中 3 个以上水果：总计 +5
- 炸弹：-5
- 分数最低为 0

第一版不扣生命，不设置漏水果惩罚。

---

## 3. 水果与障碍物

第一版使用 emoji 占位：
- 西瓜：🍉
- 凤梨：🍍
- 苹果：🍎
- 香蕉：🍌
- 炸弹：💣

后续可替换为 PNG / SVG 图片，但不影响核心逻辑。

---

## 4. 页面结构

### 首页

必须包含：
- 标题：西瓜忍者｜60秒挑战
- 副标题：滑动切水果，避开炸弹！
- 开始游戏按钮
- 最高分
- 简短规则说明

### 游戏页

必须包含：
- 当前分数
- 剩余时间
- 最高分
- 游戏区域
- 滑动刀光轨迹
- 切中反馈动画

### 结束页

必须包含：
- 游戏结束
- 本次分数
- 最高分
- 再玩一次
- 返回首页

---

## 5. 操作规则

必须同时支持：
- 桌机鼠标拖动
- 手机手指滑动

统一使用 Pointer Events：
- pointerdown
- pointermove
- pointerup
- pointercancel

游戏区域必须设置：
- touch-action: none
- user-select: none

防止手机滑动时页面滚动。

---

## 6. 游戏循环规则

使用 requestAnimationFrame。

水果对象建议结构：
```ts
interface FlyingItem {
  id: string;
  kind: FruitKind;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  radius: number;
  sliced: boolean;
  rotation: number;
  rotationSpeed: number;
}
```

每一帧：
1. 更新 x/y 坐标。
2. 更新 vy，加重力。
3. 更新旋转角度。
4. 移除超出屏幕或已切开的物件。
5. 重绘画面。

---

## 7. 碰撞检测规则

使用「滑动线段到圆心距离」判断是否切中。

逻辑：
- 每次 pointermove 获取当前点。
- 用前一点和当前点形成线段。
- 计算每个水果圆心到线段的最短距离。
- 如果距离 <= radius，判定切中。

---

## 8. 美术与 image2 调用规则

当前 MVP 先用 emoji。

如果用户要求生成图片资源，Codex 应准备 image2 提示词，不要直接硬编码不存在的图片路径。

建议输出到：
- `public/assets/watermelon.png`
- `public/assets/pineapple.png`
- `public/assets/apple.png`
- `public/assets/banana.png`
- `public/assets/bomb.png`
- `public/assets/background.png`
- `public/assets/logo.png`

image2 绘图提示词统一放在：
- `prompts/image2-assets.md`

图片风格：
- 可爱
- 明亮
- 夏日水果风
- 适合手机小游戏
- 透明背景 PNG 优先
- 物件边缘清晰
- 不要复杂背景
- 不要文字，文字由网页负责渲染

---

## 9. 开发执行顺序

Codex 必须按以下顺序执行：

### Step 1：安装与启动
```bash
npm install
npm run dev
```

检查首页是否正常显示。

### Step 2：修正基础错误
```bash
npm run lint
npm run build
```

如有 TypeScript、ESLint、Next.js 错误，先修正。

### Step 3：完善游戏逻辑
确认：
- 水果可飞出
- 水果有抛物线
- 滑动可切中水果
- 炸弹会扣分
- 60 秒倒计时结束
- 最高分可保存

### Step 4：优化手机体验
确认：
- 手机浏览器不误滚动
- 按钮够大
- 游戏区域全屏
- iPhone/Android 都可滑动

### Step 5：优化视觉
确认：
- 背景清爽
- 分数清楚
- 倒计时清楚
- 切中反馈明显
- 结束页清楚

### Step 6：部署前检查
必须通过：
```bash
npm run lint
npm run build
```

### Step 7：GitHub
```bash
git init
git add .
git commit -m "Create watermelon ninja game skeleton"
git branch -M main
git remote add origin <USER_GITHUB_REPO_URL>
git push -u origin main
```

### Step 8：Vercel
Vercel 导入 GitHub 仓库。

配置：
- Framework Preset：Next.js
- Install Command：npm install
- Build Command：npm run build
- Output Directory：留空

部署完成后回报：
1. 是否 build 成功
2. 是否部署成功
3. Production URL
4. GitHub 仓库链接
5. 当前 commit hash
6. 是否还有未提交文件

---

## 10. 回报格式

Codex 完成后必须回报：

```text
已完成：
- [项目/功能]

修改文件：
- path/to/file

验证结果：
- npm run lint：通过/失败
- npm run build：通过/失败
- 本地运行：通过/失败

Git：
- branch：main
- commit hash：xxxx
- git status：干净/有未提交

Vercel：
- Production URL：xxx

下一步建议：
- xxx
```

---

## 11. 不可破坏规则

- 不要删除 AGENTS.md。
- 不要删除 docs 文件夹。
- 不要删除 prompts 文件夹。
- 不要把游戏改成其他主题。
- 不要把简体/繁体混乱；当前项目文本以简体中文为主，用户若要求台湾版再统一改繁体。
- 修改前先理解现有结构。
- 每次修改后跑 lint/build。
