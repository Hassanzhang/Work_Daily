<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";

/* ── Config ── */
const STORAGE_KEY = "work-daily-data-v2";
const TASKS_API = "/api/tasks";
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "in-progress", label: "进行中" },
  { value: "todo", label: "待开始" },
  { value: "done", label: "已完成" }
];

const PRIORITIES = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" }
];

const STATUSES = [
  { value: "todo", label: "待开始" },
  { value: "in-progress", label: "进行中" },
  { value: "done", label: "已完成" }
];

/* ── State ── */
const tasks = ref([]);
const selectedDate = ref(todayIso());
const calendarMonth = ref(todayIso().slice(0, 7));
const currentFilter = ref("all");
const collapseCompleted = ref(false);
const composerPriority = ref("medium");
const composerTitle = ref("");
const editingTaskId = ref(null);
const pendingDeleteTaskId = ref(null);
const loading = ref(true);
const editorDraft = reactive({ title: "", priority: "medium" });

let saveTimer = null;
let saveInFlight = Promise.resolve();

/* ── Helpers ── */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function generateId() {
  return crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function datetimeNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function statusLabel(s) {
  const found = STATUSES.find((x) => x.value === s);
  return found ? found.label : s;
}

function priorityLabel(p) {
  const found = PRIORITIES.find((x) => x.value === p);
  return found ? found.label : p;
}

function nextStatus(current) {
  const idx = STATUSES.findIndex((s) => s.value === current);
  return idx < STATUSES.length - 1 ? STATUSES[idx + 1].value : STATUSES[0].value;
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-");
  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  return `${y}年${monthNames[Number(m) - 1]}${Number(d)}日`;
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split("-");
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${monthNames[Number(m) - 1]} ${y}`;
}

function serializeTask(t) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    created_at: t.created_at,
    completed_at: t.status === "done" ? (t.completed_at || datetimeNow()) : (t.completed_at || null)
  };
}

/* ── Computed ── */
const visibleTasks = computed(() => {
  const date = selectedDate.value;
  const isToday = date === todayIso();
  return tasks.value.filter((t) => {
    const datePart = t.created_at?.slice(0, 10);
    if (isToday) {
      // 今日视图：显示今天新建 + 所有历史未完成任务
      if (t.status === "done") {
        // 已完成的任务只显示今天完成的
        return (t.completed_at || t.created_at)?.startsWith(date);
      }
      // 未完成的任务：今天及之前创建的都显示
      return datePart <= date;
    }
    // 历史日期视图：只显示当天创建的
    return datePart === date;
  });
});

const filteredTasks = computed(() => {
  let list = [...visibleTasks.value];
  const date = selectedDate.value;
  list.sort((a, b) => {
    // 今日创建的任务排在最前
    const aToday = (a.created_at || "").startsWith(date);
    const bToday = (b.created_at || "").startsWith(date);
    if (aToday !== bToday) return bToday ? 1 : -1;
    // 其次按优先级
    const p = { high: 0, medium: 1, low: 2 };
    const pa = p[a.priority] ?? 99;
    const pb = p[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    // 再按状态（进行中 > 待开始 > 已完成）
    const s = { "in-progress": 0, todo: 1, done: 2 };
    return (s[a.status] ?? 99) - (s[b.status] ?? 99);
  });
  if (currentFilter.value !== "all") {
    list = list.filter((t) => t.status === currentFilter.value);
  }
  if (collapseCompleted.value) {
    list = list.filter((t) => t.status !== "done");
  }
  return list;
});

const stats = computed(() => {
  const v = visibleTasks.value;
  return {
    inProgress: v.filter((t) => t.status === "in-progress").length,
    done: v.filter((t) => t.status === "done").length,
    created: v.filter((t) => t.created_at?.startsWith(selectedDate.value)).length
  };
});

const yesterdayStats = computed(() => {
  try {
    const raw = localStorage.getItem("work-daily-stats-snapshot");
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (snap.date !== todayIso()) return snap;
    return null;
  } catch { return null; }
});

const isToday = computed(() => selectedDate.value === todayIso());

const calendarDays = computed(() => {
  const [y, m] = calendarMonth.value.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const startDay = firstDay.getDay() || 7; // Mon=1, Sun=7
  const leading = startDay - 1;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];

  for (let i = leading; i > 0; i--) {
    const d = new Date(y, m - 1, 1 - i);
    cells.push({ date: isoDate(d), day: d.getDate(), inMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`, day: i, inMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(y, m, i);
    cells.push({ date: isoDate(d), day: d.getDate(), inMonth: false });
  }
  return cells;
});

function dateHasTasks(dateIso) {
  return tasks.value.some((t) => t.created_at?.startsWith(dateIso));
}

function dateHasOpenTasks(dateIso) {
  return tasks.value.some((t) => t.created_at?.startsWith(dateIso) && t.status !== "done");
}

function dateHasCompleteOnly(dateIso) {
  const dayTasks = tasks.value.filter((t) => t.created_at?.startsWith(dateIso));
  return dayTasks.length > 0 && dayTasks.every((t) => t.status === "done");
}

/* ── Actions ── */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tasks)) tasks.value = parsed.tasks;
      if (parsed.filter) currentFilter.value = parsed.filter;
      if (typeof parsed.collapseCompleted === "boolean") collapseCompleted.value = parsed.collapseCompleted;
      if (parsed.composerPriority) composerPriority.value = parsed.composerPriority;
    }
  } catch { /* ignore */ }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tasks: tasks.value,
    filter: currentFilter.value,
    collapseCompleted: collapseCompleted.value,
    composerPriority: composerPriority.value
  }));
  saveStatsSnapshot();
  queueSync();
}

function saveStatsSnapshot() {
  if (!isToday.value) return;
  localStorage.setItem("work-daily-stats-snapshot", JSON.stringify({
    date: todayIso(),
    inProgress: stats.value.inProgress,
    done: stats.value.done,
    created: stats.value.created
  }));
}

function queueSync(immediate = false) {
  if (saveTimer) clearTimeout(saveTimer);
  if (immediate) { void syncTasks(); return; }
  saveTimer = setTimeout(() => { saveTimer = null; void syncTasks(); }, 150);
}

function syncTasks() {
  const payload = tasks.value.map(serializeTask);
  saveInFlight = saveInFlight.catch(() => undefined).then(async () => {
    try {
      const res = await fetch(TASKS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    } catch (e) { console.error(e); }
  });
  return saveInFlight;
}

async function hydrateTasks() {
  try {
    const res = await fetch(TASKS_API, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Load failed: ${res.status}`);
    const remote = await res.json();
    if (Array.isArray(remote) && remote.length) {
      tasks.value = remote;
    } else if (Array.isArray(remote) && !remote.length && tasks.value.length) {
      queueSync(true);
    }
  } catch (e) { console.error(e); }
}

function selectDate(iso) {
  selectedDate.value = iso;
  calendarMonth.value = iso.slice(0, 7);
}

function prevMonth() {
  const d = new Date(calendarMonth.value + "-01");
  d.setMonth(d.getMonth() - 1);
  calendarMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth() {
  const d = new Date(calendarMonth.value + "-01");
  d.setMonth(d.getMonth() + 1);
  calendarMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function goToday() {
  const today = todayIso();
  selectedDate.value = today;
  calendarMonth.value = today.slice(0, 7);
}

function addTask() {
  const title = composerTitle.value.trim();
  if (!title) return;
  tasks.value.push({
    id: generateId(),
    title,
    status: "in-progress",
    priority: composerPriority.value,
    created_at: `${selectedDate.value} ${new Date().toTimeString().slice(0, 8)}`,
    completed_at: null
  });
  composerTitle.value = "";
  persistState();
}

function cycleTaskStatus(taskId) {
  const task = tasks.value.find((t) => t.id === taskId);
  if (!task) return;
  const prev = task.status;
  task.status = nextStatus(prev);
  if (task.status === "done") {
    task.completed_at = datetimeNow();
  } else {
    task.completed_at = null;
  }
  persistState();
}

function openEditor(taskId) {
  editingTaskId.value = taskId;
  const task = tasks.value.find((t) => t.id === taskId);
  if (task) {
    editorDraft.title = task.title;
    editorDraft.priority = task.priority;
  }
}

function closeEditor() {
  editingTaskId.value = null;
}

function saveEditor() {
  const task = tasks.value.find((t) => t.id === editingTaskId.value);
  if (!task) return;
  task.title = editorDraft.title.trim() || task.title;
  task.priority = editorDraft.priority;
  closeEditor();
  persistState();
}

function confirmDelete(taskId) {
  tasks.value = tasks.value.filter((t) => t.id !== taskId);
  if (editingTaskId.value === taskId) closeEditor();
  pendingDeleteTaskId.value = null;
  persistState();
}

function toggleCollapse() {
  collapseCompleted.value = !collapseCompleted.value;
  persistState();
}

/* ── Status glyph ── */
function statusGlyph(status) {
  if (status === "done") return "✓";
  if (status === "in-progress") return "◉";
  return "○";
}

/* ── Init ── */
onMounted(async () => {
  loadState();
  loading.value = true;
  await hydrateTasks();
  loading.value = false;
});
</script>

<template>
  <div class="app-shell">
    <!-- ── Sidebar ── -->
    <aside class="sidebar">
      <section class="brand-block">
        <p class="eyebrow">TASK JOURNAL</p>
        <h1 class="brand-title">工作记录</h1>
        <p class="brand-copy">按天追踪，专注推进每一项任务。</p>
      </section>

      <!-- Calendar -->
      <section class="calendar-shell">
        <div class="calendar-header">
          <span class="calendar-mode">Monthly</span>
          <button class="calendar-link" type="button" @click="goToday">Today</button>
        </div>
        <div class="calendar-month-row">
          <h2 class="month-title">{{ formatMonthLabel(calendarMonth) }}</h2>
          <div class="nav-group">
            <button class="icon-button" type="button" aria-label="上一月" @click="prevMonth">‹</button>
            <button class="icon-button" type="button" aria-label="下一月" @click="nextMonth">›</button>
          </div>
        </div>
        <div class="calendar-weekdays">
          <span v-for="d in WEEKDAYS" :key="d" class="calendar-weekday">{{ d }}</span>
        </div>
        <div class="calendar-grid">
          <div v-for="cell in calendarDays" :key="cell.date" class="calendar-day">
            <button
              class="day-button"
              :class="{
                'is-outside': !cell.inMonth,
                'is-today': cell.date === todayIso(),
                'is-selected': cell.date === selectedDate,
                'has-open': dateHasOpenTasks(cell.date) && cell.date !== selectedDate,
                'is-complete': dateHasCompleteOnly(cell.date) && cell.date !== selectedDate
              }"
              type="button"
              @click="selectDate(cell.date)"
            >
              {{ cell.day }}
            </button>
          </div>
        </div>
      </section>

      <!-- Stats -->
      <section class="stats-panel">
        <article class="stat-block" :data-active="stats.inProgress > 0" data-kind="in-progress">
          <p class="stat-label">进行中</p>
          <p class="stat-value">{{ stats.inProgress }}</p>
          <p v-if="isToday && yesterdayStats" class="stat-trend" :data-trend="stats.inProgress > yesterdayStats.inProgress ? 'up' : undefined">
            {{ stats.inProgress > yesterdayStats.inProgress ? '↑' : '→' }}{{ Math.abs(stats.inProgress - yesterdayStats.inProgress) }}
          </p>
        </article>
        <article class="stat-block" :data-active="stats.done > 0" data-kind="done">
          <p class="stat-label">已完成</p>
          <p class="stat-value">{{ stats.done }}</p>
          <p v-if="isToday && yesterdayStats" class="stat-trend" :data-trend="stats.done > yesterdayStats.done ? 'up' : undefined">
            {{ stats.done > yesterdayStats.done ? '↑' : '→' }}{{ Math.abs(stats.done - yesterdayStats.done) }}
          </p>
        </article>
        <article class="stat-block" :data-active="stats.created > 0" data-kind="created">
          <p class="stat-label">{{ isToday ? "今日新增" : "当日新增" }}</p>
          <p class="stat-value">{{ stats.created }}</p>
          <p v-if="isToday && yesterdayStats" class="stat-trend" :data-trend="stats.created > yesterdayStats.created ? 'up' : undefined">
            {{ stats.created > yesterdayStats.created ? '↑' : '→' }}{{ Math.abs(stats.created - yesterdayStats.created) }}
          </p>
        </article>
      </section>
    </aside>

    <!-- ── Workspace ── -->
    <main class="workspace">
      <header class="page-head">
        <div class="title-row">
          <div class="title-stack">
            <p class="eyebrow">{{ isToday ? "TODAY" : "HISTORY" }}</p>
            <h2 class="hero-title">{{ isToday ? "今日工作" : formatDateLabel(selectedDate) }}</h2>
            <p class="hero-copy">
              <template v-if="isToday">
                <strong :style="{ color: visibleTasks.filter(t => t.status !== 'done').length ? 'var(--color-vermillion)' : 'inherit' }">
                  {{ visibleTasks.filter(t => t.status !== 'done').length }}
                </strong>
                条未完成任务
              </template>
              <template v-else>查看当日任务记录</template>
            </p>
          </div>
        </div>

        <!-- Composer -->
        <section v-if="isToday" class="add-shell">
          <div class="add-row">
            <div class="composer-title">
              <input
                v-model="composerTitle"
                type="text"
                maxlength="120"
                placeholder="记录今天要推进的工作…"
                @keydown.enter.prevent="addTask"
              />
            </div>
            <div class="composer-priority">
              <p class="composer-priority-label">优先级</p>
              <div class="priority-group">
                <button
                  v-for="p in PRIORITIES"
                  :key="p.value"
                  class="priority-chip"
                  :class="{ 'is-active': composerPriority === p.value }"
                  type="button"
                  @click="composerPriority = p.value"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>
            <button class="primary-button" type="button" @click="addTask">新增任务</button>
          </div>
        </section>
      </header>

      <!-- Task area body -->
      <div class="workspace-body" :data-editor-open="editingTaskId ? 'true' : 'false'">
        <section class="tasks-panel">
          <div class="section-row">
            <div class="section-heading">
              <h3 class="section-title">任务列表</h3>
              <span class="section-count">共 {{ visibleTasks.length }} 条</span>
            </div>
            <div class="toolbar">
              <div class="filter-group">
                <button
                  v-for="f in FILTERS"
                  :key="f.value"
                  class="filter-chip"
                  :class="{ 'is-active': currentFilter === f.value }"
                  type="button"
                  @click="currentFilter = f.value"
                >
                  {{ f.label }}
                </button>
              </div>
              <button class="soft-button" :class="{ 'is-active': collapseCompleted }" type="button" @click="toggleCollapse">
                {{ collapseCompleted ? "已折叠" : "已展开" }}
              </button>
            </div>
          </div>

          <Transition name="date-switch" mode="out-in">
            <div class="task-list" :key="selectedDate">
            <!-- Loading skeleton -->
            <div v-if="loading" class="skeleton-list">
              <div v-for="n in 3" :key="n" class="skeleton-row"></div>
            </div>

            <!-- Tasks -->
            <template v-else-if="filteredTasks.length">
            <TransitionGroup name="task-list">
              <article
                v-for="task in filteredTasks"
                :key="task.id"
                class="task-item"
                :class="{
                  'is-done': task.status === 'done',
                  'is-editing': editingTaskId === task.id
                }"
                :data-status="task.status"
                :data-priority="task.priority"
              ><div class="task-main">
                  <div class="task-status">
                    <button
                      class="task-status-button"
                      type="button"
                      aria-label="切换状态"
                      @click="cycleTaskStatus(task.id)"
                    >
                      {{ statusGlyph(task.status) }}
                    </button>
                  </div>
                  <div class="task-body">
                    <h4 class="task-title">{{ task.title }}</h4>
                  </div>
                  <div class="task-actions">
                    <button class="text-button" type="button" @click="editingTaskId === task.id ? closeEditor() : openEditor(task.id)">
                      {{ editingTaskId === task.id ? "收起" : "编辑" }}
                    </button>
                    <template v-if="pendingDeleteTaskId === task.id">
                      <div class="confirm-actions">
                        <button class="confirm-button" type="button" @click="pendingDeleteTaskId = null">取消</button>
                        <button class="confirm-button is-danger" type="button" @click="confirmDelete(task.id)">确认删除</button>
                      </div>
                    </template>
                    <button v-else class="text-button danger-button" type="button" @click="pendingDeleteTaskId = task.id">删除</button>
                  </div>
                </div>
                <div class="task-meta">
                  <div class="task-meta-cluster">
                    <span v-if="task.status !== 'done'" class="status-badge" :data-status="task.status">
                      {{ statusLabel(task.status) }}
                    </span>
                    <span class="meta-tag meta-priority" :data-priority="task.priority">
                      {{ priorityLabel(task.priority) }}
                    </span>
                  </div>
                  <span class="meta-tag meta-date">{{ task.created_at?.slice(0, 10) }}</span>
                </div>
              </article>
            </TransitionGroup>
            </template>

            <!-- Empty -->
            <section v-else class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
              <h4 class="empty-title">还没有任务</h4>
              <p class="empty-hint">在输入框中记录今天要推进的工作吧</p>
            </section>
          </div>
          </Transition>
        </section>

        <!-- Editor panel -->
        <aside v-if="editingTaskId" class="editor-panel" aria-label="编辑任务">
          <div class="editor-panel-card">
            <div class="editor-panel-head">
              <h4 class="editor-panel-title">编辑任务</h4>
              <button class="editor-close" type="button" aria-label="关闭" @click="closeEditor">×</button>
            </div>
            <div class="editor-panel-body">
              <div class="editor-field editor-field--title">
                <label class="editor-label">任务名称</label>
                <textarea
                  v-model="editorDraft.title"
                  class="editor-title-input"
                  rows="2"
                  maxlength="120"
                  @keydown.meta.enter="saveEditor"
                  @keydown.ctrl.enter="saveEditor"
                ></textarea>
              </div>
              <div class="editor-field editor-field--priority">
                <label class="editor-label">优先级</label>
                <div class="priority-group">
                  <button
                    v-for="p in PRIORITIES"
                    :key="p.value"
                    class="priority-chip"
                    :class="{ 'is-active': editorDraft.priority === p.value }"
                    type="button"
                    @click="editorDraft.priority = p.value"
                  >
                    {{ p.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="editor-panel-actions">
              <p class="editor-activity-line">
                {{ tasks.find(t => t.id === editingTaskId)?.created_at?.slice(0, 10) || "" }}
              </p>
              <div style="display:flex;gap:8px;">
                <button class="soft-button" type="button" @click="closeEditor">取消</button>
                <button class="primary-button" type="button" @click="saveEditor">保存</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>
