# Work Daily — 原型图生成提示词

---

## 版本一：Midjourney / DALL-E（英文为主）

```
A clean, minimal productivity web app interface in the style of a Japanese paper planner (Hobonichi Techo / Traveler's Notebook aesthetic). Light mode only.

LAYOUT: Two-column dashboard. Left sidebar (30% width) contains a monthly calendar grid with a vermillion-red circled date, three small stat cards below showing numbers. Right main area (70%) contains a task list with 5-6 items, each with a status checkbox, task title, priority badge, and date tag.

COLORS: Paper-white background #FAFAF6, warm black text #1C1C18, pencil-gray secondary text #63635E, vermillion red accent #B22222 for selected states and high-priority indicators, kraft paper surface #F1EFE9 for cards, subtle edge borders #D8D5CC, pine green #3B7A3B for completed items.

TYPOGRAPHY: Clean sans-serif system font (SF Pro / PingFang SC), no external web fonts. Headlines in bold weight, body text in regular weight. Task titles at 15px bold, metadata at 10-12px.

DETAILS:
- Calendar: 7-column day grid, selected day has a thin vermillion circle outline, days with tasks have a small red dot below the number
- Task items: each has a 3px left border in vermillion (in-progress high priority), amber (medium), or gray (low). Completed items show pine green left border with strikethrough title
- Stats cards: three cards in a row showing "进行中" / "已完成" / "今日新增" with large bold numbers
- Top navigation: two tabs "工作记录" / "会员管理" in a subtle gray segmented control
- Minimal shadows: only one subtle shadow level (0 1px 3px rgba(0,0,0,0.04))
- Rounded corners: restrained, mostly 6-8px, never full pill shapes except for calendar day buttons
- No gradients, no blur effects, no excessive decoration

STYLE: Editorial minimalism, Japanese stationery aesthetic, warm paper texture feel, red ink accent as the only bold color, no purple-blue gradients, no glassmorphism.

Aspect ratio: 16:10, wide desktop view. No people, no photography, pure UI mockup.
```

---

## 版本二：中文优化（适用于支持中文的模型）

```
一个简洁克制的生产力 Web 应用界面，日本文具手帐风格（Hobonichi / Traveler's Notebook 美学），浅色模式。

布局：左右双栏。左侧窄栏（约占 30%）包含一个月历网格和三个统计卡片。右侧主区域为任务列表，展示 5-6 条任务。

配色方案（严格遵循）：
- 底色：#FAFAF6（MD纸白，暖白非纯白）
- 主文字：#1C1C18（墨色，暖黑）
- 次级文字：#63635E（铅笔灰）
- 唯一强调色：#B22222（朱红，用于选中日期、高优先级、激活态）
- 卡片表面：#F1EFE9（牛皮纸色，非纯白）
- 边框分割：#D8D5CC（纸缘色）
- 完成/成功：#3B7A3B（松绿）

关键细节：
1. 月历：7列网格，被选中的日期用朱红细圆圈标记，有任务的日期下方有 6px 朱红小圆点
2. 任务条目：每条左侧有 3px 色条——高优先级朱红、中优先级琥珀、低优先级灰、已完成松绿
3. 统计卡片：三张卡片并排，分别显示"进行中""已完成""今日新增"及大号加粗数字，当日有昨日对比箭头
4. 顶部标签切换："工作记录""会员管理"两个标签，当前选中的白底轻阴影
5. 阴影极克制：仅一层 card shadow，无玻璃模糊、无渐变
6. 圆角克制：6-8px 为主，仅日历日按钮用全圆
7. 无蓝色/紫色渐变、无全药片按钮、无过度装饰

字体：SF Pro / PingFang SC 系统字体，标题加粗（680 weight），正文常规。任务名称 15px bold，元数据 10-12px。

风格：编辑感极简主义，纸质手帐质感，朱红作为唯一出挑色，暖白基调。16:10 宽屏桌面视图，纯 UI 界面，无人物。
```

---

## 分页面提示词（如需分别生成）

### 工作记录页（WorkDailyView）

```
Focus on the task list page. Right side shows a header "今日工作" with an input field at top for adding tasks. Below that, 5-6 task items in card-like rows. Left sidebar shows the calendar with a vermillion-circled date (today). Three stats cards below the calendar. Top has two navigation tabs.
```

### 会员管理页（MembershipsView）

```
Focus on the membership tracking page. Right side shows a list of subscription items, each with: name (17px bold), status badge, date timeline with a connecting line, and a thick progress bar (8px height) showing usage percentage. Each item has edit/delete actions. Left sidebar shows a summary card with total/expiring/expired counts and an urgent alerts list. Top input area for adding new memberships with name, date picker, and price fields.
```

---

## 使用建议

| 工具 | 推荐版本 | 参数建议 |
|------|---------|---------|
| Midjourney | 版本一（英文） | `--ar 16:10 --style raw --s 50` |
| DALL-E 3 | 版本一（英文） | 天然 16:9，接近即可 |
| Stable Diffusion | 版本一（英文） | 配合 ControlNet + IP-Adapter |
| 国产模型（通义等） | 版本二（中文） | 直接使用 |
| Figma AI / Uizard | 版本一（英文） | 作为设计 brief 输入 |
