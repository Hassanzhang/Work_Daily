<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { initWorkDaily } from "../legacy/initWorkDaily";

const rootEl = ref(null);
let dispose = () => {};

onMounted(async () => {
  await nextTick();
  dispose = initWorkDaily(rootEl.value);
});

onBeforeUnmount(() => {
  dispose();
});
</script>

<template>
  <div ref="rootEl" class="app-shell">
    <aside class="sidebar">
      <section class="brand-block">
        <p class="eyebrow">Daily task log</p>
        <h1 class="brand-title">Work Daily</h1>
        <p class="brand-copy">按天记录，专注推进。</p>
      </section>

      <section class="calendar-shell">
        <div class="calendar-header">
          <span class="calendar-mode">Monthly</span>
          <button class="calendar-link" type="button" id="goToday">回到今天</button>
        </div>
        <div class="calendar-month-row">
          <h2 class="month-title" id="monthTitle"></h2>
          <div class="nav-group">
            <button class="icon-button" id="prevMonth" type="button" aria-label="上一月">‹</button>
            <button class="icon-button" id="nextMonth" type="button" aria-label="下一月">›</button>
          </div>
        </div>
        <div class="calendar-strip">
          <div class="calendar-weekdays" id="calendarWeekdays"></div>
          <div class="calendar-grid" id="calendarGrid"></div>
        </div>
      </section>

      <section class="stats-panel" id="statsPanel"></section>
    </aside>

    <main class="workspace">
      <header class="page-head">
        <div class="title-row">
          <div class="title-stack">
            <p class="eyebrow" id="contextEyebrow"></p>
            <h2 class="hero-title" id="heroTitle"></h2>
            <p class="hero-copy" id="heroCopy"></p>
          </div>
        </div>

        <section class="add-shell" aria-label="新增任务">
          <div class="add-row" id="composerRow">
            <div class="composer-title">
              <input
                id="newTaskTitle"
                type="text"
                maxlength="120"
                placeholder="记下一条今天要推进的工作任务"
              />
            </div>
            <div class="composer-priority">
              <p class="composer-priority-label">优先级</p>
              <div class="priority-group" id="composerPriority"></div>
            </div>
            <button class="primary-button" type="button" id="addTaskButton">新增任务</button>
          </div>
        </section>
      </header>

      <div class="workspace-body">
        <section class="tasks-panel">
          <div class="section-row">
            <div>
              <div class="section-heading">
                <h3 class="section-title">任务列表</h3>
                <span class="section-count" id="taskCount"></span>
              </div>
            </div>
            <div class="toolbar">
              <div class="filter-group" id="filterGroup"></div>
              <button class="soft-button" type="button" id="toggleCompleted">折叠已完成</button>
            </div>
          </div>
          <div class="task-list" id="taskList"></div>
        </section>
        <aside class="editor-panel" id="editorPanel" aria-label="编辑任务"></aside>
      </div>
    </main>
  </div>
</template>
