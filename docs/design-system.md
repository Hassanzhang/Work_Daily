# Work Daily — Design System

> 设计方向：日本文具 Hobonichi / Traveler's Notebook 风格  
> 关键词：克制、纸质感、编辑感、单一朱红强调

---

## 色彩系统

| Token | Hex | 用途 |
|-------|-----|------|
| `--color-paper` | `#FAFAF6` | 页面底色（MD纸白） |
| `--color-ink` | `#1C1C18` | 主文字（墨色，暖黑） |
| `--color-pencil` | `#63635E` | 次级文字、元数据（铅笔灰） |
| `--color-vermillion` | `#B22222` | **唯一强调色** — 选中态、高优先级、激活指示 |
| `--color-vermillion-d` | `#8B1A1A` | 朱红深色（hover/按下态） |
| `--color-kraft` | `#F1EFE9` | 卡片/侧栏底色（牛皮纸） |
| `--color-kraft-dark` | `#E8E5DC` | 低优先级标签底、hover 态 |
| `--color-edge` | `#D8D5CC` | 边框、分割线（纸缘） |
| `--color-pine` | `#3B7A3B` | 完成状态（松绿 — 像绿色完成章） |
| `--color-pine-soft` | `#E8F0E8` | 完成态淡底 |

### 优先级色

| 优先级 | 标签色 | 进行中左边框 |
|--------|--------|-------------|
| 高 `high` | 朱红底 `rgba(178,34,34,0.10)` + `#B22222` | `#B22222` |
| 中 `medium` | 琥珀底 `rgba(180,130,20,0.08)` + `#8B6914` | `#C8960C` |
| 低 `low` | 牛皮纸灰底 `--color-kraft-dark` + 铅笔灰 | `--color-pencil` |

---

## 字体

| 角色 | 字体栈 |
|------|--------|
| 展示/标题 (`--font-display`) | SF Pro Display → SF Pro SC → PingFang SC → system-ui |
| 正文 UI (`--font-ui`) | SF Pro Display → SF Pro SC → PingFang SC → system-ui |
| 等宽/数据 (`--font-mono`) | SF Mono → Cascadia Code → JetBrains Mono → ui-monospace |

### 字重层级

| 元素 | Weight | 字号 |
|------|--------|------|
| Hero 标题 `.hero-title` | 680 | 30px |
| 侧栏标题 `.brand-title` | 680 | 26px |
| 月份标题 `.month-title` | 680 | 25px |
| 统计数值 `.stat-value` | 760 | 30px |
| 会员概览标题 `.membership-summary-title` | 640 | 20px |
| 会员数值 `.summary-metric-value` | 640 | 24px |
| 任务标题 `.task-title` | 520 | 14px |
| 正文/标签 | 460–620 | 10–15px |
| 元数据/日期 | 480–520 | 10–12px |

---

## 元素高度

| 元素 | 高度 | 说明 |
|------|------|------|
| **主要输入框** | | |
| 任务 composer 输入 `.composer-title input` | 42px | 牛皮纸底，6px 圆角 |
| 会员名称输入 | 42px | 同上 |
| 编辑器标题 textarea | ≥52px | 无边框，底线 |
| **按钮** | | |
| 主按钮 `.primary-button` | 42px | 朱红底白字，hover 变深 |
| 次按钮 `.soft-button` | 32px | 牛皮纸底，hover 朱红 |
| 滤镜芯片 `.filter-chip` | 28px | 分组内嵌 |
| 文本按钮 `.text-button` | 28px | 透明底，hover 牛皮纸 |
| 确认按钮 `.confirm-button` | 26px | 内联删除确认 |
| 优先级芯片 `.priority-chip` | 30px | — |
| **状态/徽章** | | |
| 状态徽章 `.status-badge` | 22px | 3px 圆角 |
| 元数据标签 `.meta-tag` | 22px | 同上 |
| **Meta 行（会员新增）** | | |
| Meta 编辑器 `.membership-meta-editor` | 28px | 价格/备注内联编辑 |
| Meta 芯片 `.membership-meta-chip` | 28px | 未展开态 |
| Meta 行日期选择器 `.dp-trigger` | 28px | 重写为 `inline-grid`，与其他 meta 元素等高 |
| **Tab 导航** | | |
| Tab 触发器 `.app-tabs__trigger` | 36px | — |
| **日历** | | |
| 日历日按钮 `.day-button` | 32×32px | 正圆 |
| 日历导航钮 `.icon-button` | 28×28px | — |

---

## 间距

基于 4px 节奏：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`

侧栏宽度：316px（窄屏 280px，移动端自适应）

---

## 圆角

克制使用，避免全药片泛滥：

| Token | 值 | 用途 |
|-------|-----|------|
| `--r-none` | 0 | — |
| `--r-xs` | 3px | 标签/徽章 |
| `--r-sm` | 6px | 按钮/输入框/芯片 |
| `--r-md` | 8px | 卡片/面板 |
| `--r-full` | 9999px | 仅日历日按钮、状态圈 |

---

## 阴影

仅一个层级，有意克制：

- `--shadow-card`: `0 1px 3px rgba(28,28,24,0.04)` — 卡片
- `--shadow-raised`: `0 2px 8px rgba(28,28,24,0.06)` — 浮层

---

## 动效

| Token | 值 | 用途 |
|-------|-----|------|
| `--dur-100` | 100ms | hover/微交互 |
| `--dur-150` | 150ms | 状态切换 |
| `--dur-200` | 200ms | 列表进出 |
| `--dur-300` | 300ms | 面板展开 |

所有动效尊重 `prefers-reduced-motion`。

---

## 组件

### DatePickerLume

日期选择器，用于会员页的「到期日期」和「开通日期」。

- 打开默认显示**日选择器**（而非年 → 月 → 日三级跳）
- 年/月/日可通过顶部分段控件直接切换
- 年份范围：当前年 ± 5 年（共 21 年），自动对齐今年
- 选中的日期：朱红圆圈标记（与主页日历一致）
- 触发框：42px 高（主 composer 行）/ 28px 高（meta 行），牛皮纸底
- 弹出面板：纸白底，无模糊玻璃效果

### AppTabs

顶部标签切换「工作记录」「会员管理」，当前标签白底 + 轻阴影。

---

## 标志性元素

日历今日：**朱红实心填充 + 白字**，醒目标识当天。
日历选中日：**朱红圆圈标记**，像在纸质手帐上圈出重要日期。
有任务的日子：用小圆点标示（今日有任务时圆点为白色）。

统计趋势：↑ 变化用松绿色（表示"有变化"），→ 持平用铅笔灰。

---

## 设计原则

1. **一个强调色** — 朱红是最强信号，不与其他色争抢
2. **左边界线** — 任务项通过 3px 左边框传达状态和优先级
3. **纸张底色** — 卡片用牛皮纸色而非纯白，营造温暖纸质感
4. **字体一致** — 全站使用用户系统字体，不引入外部字体
5. **少即是多** — 阴影、圆角、动效都保持最低必要量
