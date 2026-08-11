# 倒时·日程 (Daoshi) — 网页版

一个智能日程管理工具，支持任务排期、冲突检测、专注计时和人机对话（AI 助手）。纯前端应用，数据保存在浏览器本地，无需服务器即可部署。

---

## 功能总览

### 1. 日历 / 列表

- **三种视图模式**：日常生活 / 复习考试周 / 紧急异常（考试周与紧急模式下自动过滤娱乐类任务）
- **列表模式**：展示当天待完成的任务，支持标记完成、进入专注、调整时间
- **日历模式**：
  - 竖向日期：未来 14 天按日展示
  - 横向日期：周视图，支持左右滑动/翻页切换周次，点击日期标题可弹出月历跳转
- 每个时间段块上直接提供操作按钮：
  - **标记完成**：勾选后该时间段显示为完成状态
  - **进入专注**：跳转到专注计时器
  - **调整时间**：打开「调整专注时间段」弹窗，可修改开始/结束时间、重命名专注块、切换完成状态（仅专注块与弹性学习块可用）

### 2. 已录入任务

- 查看、搜索、管理所有已录入的任务
- 新建 / 编辑任务支持以下字段：
  - 标题
  - 分类：学习/作业、娱乐、上课/考试、专注、生活
  - 截止时间、预估时长
  - 每日安排：稳步推进 / 拆成多段 / 提前前移
  - 时间属性：固定时间（上课/活动）或弹性任务（自由安排）
  - 每周重复、地点、冲突提醒开关
- 支持删除任务

### 3. 冲突提醒

- 自动检测三类冲突：
  - 固定时间段之间的**时间重叠**
  - **固定事件与截止时间之间的冲突**（弹性任务被固定任务挤占）
  - **弹性任务时间不足**（截止时间前空闲时段不够完成预估时长）
- 按风险分级（高 / 中），给出具体调整建议：前移任务、拆分成多段、保持计划并开启提醒等
- 支持一键应用建议，并可**撤销**最近一次调整
- **启用 LLM 后**：进入冲突提醒页会自动调用大语言模型生成 AI 分析，输出更详细的冲突来源、最晚开始时间与排期方案

### 4. 人机对话（AI 助手）

- 用自然语言管理日程：
  - 添加新任务、删除任务、修改任务（标题、截止时间、时长、分类等）
  - 分析日程冲突、生成专注时段、回答日程相关问题
- 支持**图片与文件附件**：可直接粘贴图片，或上传 PDF / Word / Excel / PPT / txt / csv / json / zip 等文件，AI 会读取文件内容并据此创建任务
- 对话时会把当前任务列表作为上下文发送给模型，保证操作准确
- ⚠️ 此功能**必须配置大语言模型 API**（见下方「调用 AI 大语言模型」）

### 5. 专注计时

- 倒计时 + 正计时双模式
- 支持调整专注时间段、为专注块自定义名称（如「复习红黑树」「刷题练习」）
- 计时结束有强提示与循环响铃，可手动关闭

### 6. 用户系统

- 邮箱 / 手机号注册登录（密码需 8 位以上且含大小写字母和数字）
- 手机验证码登录（本地模拟演示，验证码会直接显示在登录弹窗中）
- 微信 / Google / Apple 模拟登录
- 不同账号的数据相互隔离（按账号分别存储在 localStorage）

### 7. 个性化

- 自定义头像（上传图片）、用户名、手机号
- 深色模式：跟随系统 / 浅色 / 深色
- 通知铃声：铃铛 / 叮咚 / 电子 / 提醒
- 应用模式切换（日常生活 / 复习考试周 / 紧急异常）

---

## 调用 AI 大语言模型（必读）

「人机对话」和「AI 冲突分析」需要调用大语言模型 API。**API Key 由你自己提供**，不会内置在代码或仓库中。

### 第一步：准备 API Key

前往对应服务商注册账号并创建 API Key：

| 提供商 | 默认接入模型 | API Key 获取地址 |
| --- | --- | --- |
| DeepSeek | `deepseek-chat` | <https://platform.deepseek.com> |
| 通义千问 Qwen | `qwen-plus` | 阿里云百炼：<https://bailian.console.aliyun.com/> |
| OpenAI GPT | `gpt-4o-mini` | <https://platform.openai.com> |
| 自定义 | 自填 | 任意兼容 OpenAI Chat Completions 格式的接口（base URL + 模型名） |

### 第二步：在应用中配置

1. 打开应用，进入「设置」（侧边栏抽屉）
2. 找到「语言模型 (LLM)」区块
3. 打开「**启用 LLM**」开关
4. 选择提供商：DeepSeek / Qwen / GPT / 自定义
5. 粘贴你的 **API Key**（形如 `sk-...`）
6. 若选择「自定义」：还需填写**自定义 URL**（如 `https://api.example.com/v1`）和**模型名称**
7. 保存后即可使用

### 注意事项

- API Key **仅保存在当前浏览器的 localStorage 中**，不会上传到任何服务器，也不会出现在代码仓库里
- 切换浏览器或清空浏览器数据后需要重新配置
- 调用 API 会产生服务商相应费用，请留意账户余额与额度
- 若请求失败，请依次检查：
  - API Key 是否有效、是否复制完整（无多余空格）
  - 服务商账户是否有余额 / 免费额度
  - 网络是否能访问对应服务商（部分区域访问 OpenAI 需要代理）
- 预设提供商已内置官方接入地址与默认模型，无需手动填写

---

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- TailwindCSS 样式
- Zustand 状态管理
- HashRouter 路由（支持静态托管）
- localStorage 数据持久化

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build
```

构建产物在 `dist/` 目录，可直接部署到任何静态托管服务。

## 部署

应用为纯前端、无后端依赖，支持以下平台：

- **GitHub Pages** — 构建命令 `npm run build`，上传 `dist/` 内容；若仓库路径为子路径（`https://用户名.github.io/仓库名/`），需在 `vite.config.ts` 中设置 `base: '/仓库名/'`，否则静态资源路径会 404
- **Vercel** — 导入 Git 仓库，自动识别并部署
- **Netlify** — 连接 Git 仓库，构建命令 `npm run build`，输出目录 `dist`
- **Cloudflare Pages** — 连接 Git 仓库，构建命令 `npm run build`，输出目录 `dist`

---

# Daoshi — Web App (English)

A smart schedule management tool with task scheduling, conflict detection, focus timer, and AI-powered chat. Pure frontend app with data stored in browser localStorage — no backend required.

---

## Feature Overview

### 1. Calendar / List

- **Three view modes**: Daily / Exam Prep / Emergency (entertainment tasks are automatically filtered out in Exam Prep and Emergency modes)
- **List mode**: shows today's incomplete tasks with quick actions (mark complete, start focus, adjust time)
- **Calendar mode**:
  - Vertical dates: next 14 days listed day by day
  - Horizontal dates: week view with swipe/page navigation; tap the date title to open a month picker and jump to any date
- Every time block directly provides action buttons:
  - **Mark complete**: shows the block as completed
  - **Start focus**: opens the focus timer
  - **Adjust time**: opens the "Adjust Focus Block" sheet to edit start/end time, rename the block, or toggle its completion state (available for focus blocks and flexible study blocks only)

### 2. Task Management

- View, search, and manage all recorded tasks
- Create / edit tasks with these fields:
  - Title
  - Category: Study/Homework, Entertainment, Class/Exam, Focus, Life
  - Deadline, estimated hours
  - Daily plan: Steady / Split / Front-load
  - Time type: fixed time (classes/events) or flexible task (freely scheduled)
  - Weekly repeat, location, conflict reminder toggle
- Supports deleting tasks

### 3. Conflict Alerts

- Automatically detects three kinds of conflicts:
  - **Time overlaps** between fixed blocks
  - **Fixed-event vs. deadline conflicts** (flexible tasks squeezed by fixed events)
  - **Insufficient flexible time** (not enough free slots before the deadline to finish the estimated hours)
- Risk grading (High / Medium) with concrete suggestions: move earlier, split into segments, keep plan + enable reminders, etc.
- One-click apply of suggestions with **undo** support
- **When LLM is enabled**: entering the conflict page auto-calls the LLM to generate an AI analysis with detailed conflict sources, latest start time, and scheduling plans

### 4. AI Assistant (Chat)

- Manage your schedule in natural language:
  - Add, delete, and update tasks (title, deadline, duration, category, etc.)
  - Analyze schedule conflicts, generate focus blocks, answer schedule questions
- Supports **image and file attachments**: paste images directly, or upload PDF / Word / Excel / PPT / txt / csv / json / zip files — the AI reads the file content and can create tasks from it
- Sends the current task list to the model as context so operations stay accurate
- ⚠️ This feature **requires an LLM API configuration** (see "AI / LLM Setup" below)

### 5. Focus Timer

- Countdown & count-up dual modes
- Adjust focus block time ranges and give each block a custom name (e.g., "Review red-black trees", "Practice problems")
- Strong alert with looping ringtone when the timer finishes; can be dismissed manually

### 6. User System

- Email / phone registration & login (password requires 8+ characters with uppercase, lowercase, and digits)
- Phone verification-code login (locally simulated for demo — the code is shown directly in the login modal)
- Simulated social login: WeChat / Google / Apple
- Data is isolated per account (stored separately in localStorage)

### 7. Personalization

- Custom avatar (upload image), username, phone number
- Dark mode: follow system / light / dark
- Notification ringtones: Bell / Chime / Electronic / Alert
- App mode switching (Daily / Exam Prep / Emergency)

---

## AI / LLM Setup (Required for Chat & AI Conflict Analysis)

The Chat and AI conflict analysis features call a large language model API. **You must provide your own API key** — it is never bundled into the code or repo.

### Step 1: Get an API Key

Sign up with a provider and create an API key:

| Provider | Default model | Where to get the API key |
| --- | --- | --- |
| DeepSeek | `deepseek-chat` | <https://platform.deepseek.com> |
| Qwen (Alibaba) | `qwen-plus` | Alibaba Cloud Bailian: <https://bailian.console.aliyun.com/> |
| OpenAI GPT | `gpt-4o-mini` | <https://platform.openai.com> |
| Custom | fill in yourself | Any OpenAI Chat Completions-compatible endpoint (base URL + model name) |

### Step 2: Configure in the App

1. Open the app and go to **Settings** (sidebar drawer)
2. Find the **Language Model (LLM)** section
3. Turn on the **Enable LLM** toggle
4. Pick a provider: DeepSeek / Qwen / GPT / Custom
5. Paste your **API key** (e.g., `sk-...`)
6. If you chose **Custom**, also fill in the **custom URL** (e.g., `https://api.example.com/v1`) and the **model name**
7. Save and start using it

### Notes

- The API key is **stored only in your browser's localStorage** — it is never uploaded to any server and never appears in the repo
- You will need to reconfigure after switching browsers or clearing browser data
- Calling the API may incur provider charges; keep an eye on your balance/quota
- If requests fail, check in order:
  - Is the API key valid and copied completely (no stray spaces)?
  - Does the provider account have balance / free quota?
  - Can your network reach the provider? (Accessing OpenAI from some regions may require a proxy)
- Preset providers ship with official endpoint URLs and default models — no manual entry needed

---

## Tech Stack

React 18 + TypeScript · Vite · TailwindCSS · Zustand · HashRouter · localStorage

## Quick Start

```bash
npm install
npm run dev      # development server
npm run build    # production build (output in dist/)
```

The build output is in the `dist/` directory, ready for deployment to any static hosting service.

## Deployment

The app is pure frontend with no backend dependencies:

- **GitHub Pages** — build with `npm run build` and upload the `dist/` contents; if the repo lives at a subpath (`https://username.github.io/repo-name/`), set `base: '/repo-name/'` in `vite.config.ts`, otherwise static assets will 404
- **Vercel** — import the Git repo; auto-detected and deployed
- **Netlify** — connect the Git repo, build command `npm run build`, output dir `dist`
- **Cloudflare Pages** — connect the Git repo, build command `npm run build`, output dir `dist`
