export function initWorkDaily(rootEl) {
  if (!rootEl) return () => {};
    const STORAGE_KEY = "work-daily-data-v1";
    const TASKS_API = "/api/tasks";
    const weekdayNames = ["一", "二", "三", "四", "五", "六", "日"];
    const filters = [
      { value: "all", label: "全部" },
      { value: "in-progress", label: "进行中" },
      { value: "todo", label: "待开始" },
      { value: "done", label: "已完成" }
    ];
    const priorities = [
      { value: "high", label: "高" },
      { value: "medium", label: "中" },
      { value: "low", label: "低" }
    ];
    let pendingDeleteTaskId = null;
    let editingTaskId = null;
    let editorDraft = null;
    let previousStats = { inProgress: 0, done: 0, created: 0 };
    let shouldAnimateTaskList = true;
    let isCollapsingCompleted = false;
    let saveTimer = null;
    let saveInFlight = Promise.resolve();
    const statuses = [
      { value: "todo", label: "待开始" },
      { value: "in-progress", label: "进行中" },
      { value: "done", label: "已完成" }
    ];
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { "in-progress": 0, todo: 1, done: 2 };

    const state = loadState();

    const monthTitle = rootEl.querySelector("#monthTitle");
    const calendarWeekdays = rootEl.querySelector("#calendarWeekdays");
    const calendarGrid = rootEl.querySelector("#calendarGrid");
    const statsPanel = rootEl.querySelector("#statsPanel");
    const contextEyebrow = rootEl.querySelector("#contextEyebrow");
    const heroTitle = rootEl.querySelector("#heroTitle");
    const heroCopy = rootEl.querySelector("#heroCopy");
    const goToday = rootEl.querySelector("#goToday");
    const newTaskTitle = rootEl.querySelector("#newTaskTitle");
    const composerPriority = rootEl.querySelector("#composerPriority");
    const addTaskButton = rootEl.querySelector("#addTaskButton");
    const filterGroup = rootEl.querySelector("#filterGroup");
    const workspaceBody = rootEl.querySelector(".workspace-body");
    const taskList = rootEl.querySelector("#taskList");
    const taskCount = rootEl.querySelector("#taskCount");
    const toggleCompleted = rootEl.querySelector("#toggleCompleted");
    const editorPanel = rootEl.querySelector("#editorPanel");

    bindEvents();
    render();
    hydrateTasks();
    taskList.addEventListener("scroll", handleTaskListScroll);

    function loadState() {
      const today = isoDate(new Date());
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return {
            tasks: [],
            selectedDate: today,
            calendarMonth: today.slice(0, 7),
            filter: "all",
            collapseCompleted: false,
            composerPriority: "medium"
          };
        }
        const parsed = JSON.parse(raw);
        return {
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((task) => {
            const normalizedTask = { ...task };
            delete normalizedTask.notes;
            delete normalizedTask.isExpanded;
            return deserializeTask(normalizedTask);
          }) : [],
          selectedDate: today,
          calendarMonth: today.slice(0, 7),
          filter: parsed.filter || "all",
          collapseCompleted: Boolean(parsed.collapseCompleted),
          composerPriority: parsed.composerPriority || "medium"
        };
      } catch (error) {
        return {
          tasks: [],
          selectedDate: today,
          calendarMonth: today.slice(0, 7),
          filter: "all",
          collapseCompleted: false,
          composerPriority: "medium"
        };
      }
    }

    function persistState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tasks: state.tasks,
        selectedDate: state.selectedDate,
        calendarMonth: state.calendarMonth,
        filter: state.filter,
        collapseCompleted: state.collapseCompleted,
        composerPriority: state.composerPriority
      }));
      queueTaskSync();
    }

    function queueTaskSync(immediate = false) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (immediate) {
        void syncTasks();
        return;
      }
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        void syncTasks();
      }, 120);
    }

    function syncTasks() {
      const payload = state.tasks.map(serializeTask);
      saveInFlight = saveInFlight
        .catch(() => undefined)
        .then(async () => {
          try {
            const response = await fetch(TASKS_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (!response.ok) {
              throw new Error(`Failed to sync tasks: ${response.status}`);
            }
          } catch (error) {
            console.error(error);
          }
        });
      return saveInFlight;
    }

    async function hydrateTasks() {
      try {
        const response = await fetch(TASKS_API, {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) {
          throw new Error(`Failed to load tasks: ${response.status}`);
        }
        const remoteTasks = await response.json();
        if (Array.isArray(remoteTasks)) {
          if (!remoteTasks.length && Array.isArray(state.tasks) && state.tasks.length) {
            queueTaskSync(true);
            return;
          }
          state.tasks = remoteTasks.map(deserializeTask);
          render();
        }
      } catch (error) {
        console.error(error);
      }
    }

    function bindEvents() {
      rootEl.querySelector("#prevMonth").addEventListener("click", () => {
        const previousMonthDate = shiftSelectedDateByMonth(state.selectedDate, -1);
        state.selectedDate = previousMonthDate;
        state.calendarMonth = previousMonthDate.slice(0, 7);
        shouldAnimateTaskList = true;
        render();
        persistState();
      });

      rootEl.querySelector("#nextMonth").addEventListener("click", () => {
        const nextMonthDate = shiftSelectedDateByMonth(state.selectedDate, 1);
        state.selectedDate = nextMonthDate;
        state.calendarMonth = nextMonthDate.slice(0, 7);
        shouldAnimateTaskList = true;
        render();
        persistState();
      });

      goToday.addEventListener("click", () => {
        const today = isoDate(new Date());
        state.selectedDate = today;
        state.calendarMonth = today.slice(0, 7);
        shouldAnimateTaskList = true;
        render();
        persistState();
      });

      addTaskButton.addEventListener("click", addTask);
      newTaskTitle.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addTask();
        }
      });

      toggleCompleted.addEventListener("click", () => {
        toggleCompletedTasks();
      });
    }

    function render() {
      renderCalendar();
      renderHeader();
      renderStats();
      renderComposerPriority();
      renderFilters();
      renderTaskList();
      renderEditorPanel();
    }

    function renderComposerPriority() {
      composerPriority.innerHTML = priorities.map((priority) => {
        const activeClass = priority.value === state.composerPriority ? "priority-chip is-active" : "priority-chip";
        return `<button type="button" class="${activeClass}" data-priority-choice="${priority.value}" data-priority-value="${priority.value}">${priority.label}</button>`;
      }).join("");

      composerPriority.querySelectorAll("[data-priority-choice]").forEach((button) => {
        button.addEventListener("click", () => {
          state.composerPriority = button.dataset.priorityChoice;
          renderComposerPriority();
          persistState();
        });
      });
    }

    function renderFilters() {
      filterGroup.innerHTML = filters.map((filter) => {
        const activeClass = filter.value === state.filter ? "filter-chip is-active" : "filter-chip";
        return `<button type="button" class="${activeClass}" data-filter="${filter.value}">${filter.label}</button>`;
      }).join("");

      filterGroup.querySelectorAll("[data-filter]").forEach((button) => {
        button.addEventListener("click", () => {
          state.filter = button.dataset.filter;
          shouldAnimateTaskList = true;
          renderFilters();
          renderTaskList();
          persistState();
        });
      });
    }

    function renderCalendar() {
      const displayMonth = new Date(`${state.calendarMonth}-01T00:00:00`);
      const month = displayMonth.getMonth();
      const year = displayMonth.getFullYear();
      const monthStart = startOfMonthGrid(displayMonth);
      const today = isoDate(new Date());

      monthTitle.textContent = formatMonthDisplay(year, month);
      calendarWeekdays.innerHTML = weekdayNames
        .map((weekday) => `<span class="calendar-weekday">${weekday}</span>`)
        .join("");
      calendarGrid.innerHTML = "";

      for (let index = 0; index < 42; index += 1) {
        const day = new Date(monthStart);
        day.setDate(monthStart.getDate() + index);
        const iso = isoDate(day);
        const wrapper = document.createElement("div");
        wrapper.className = "calendar-day";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "day-button";
        const label = document.createElement("span");
        label.textContent = String(day.getDate());
        const openState = hasOpenTask(iso);
        const recordState = hasRecord(iso);
        if (day.getMonth() !== month) button.classList.add("is-outside");
        if (iso === today) button.classList.add("is-today");
        if (recordState && !openState) button.classList.add("is-complete");
        if (openState) button.classList.add("has-open");
        if (iso === state.selectedDate) button.classList.add("is-selected");
        button.addEventListener("click", () => {
          state.selectedDate = iso;
          state.calendarMonth = iso.slice(0, 7);
          shouldAnimateTaskList = true;
          render();
          persistState();
        });
        button.appendChild(label);
        wrapper.appendChild(button);
        calendarGrid.appendChild(wrapper);
      }
    }

    function renderHeader() {
      const today = isoDate(new Date());
      const selected = state.selectedDate;
      const isToday = selected === today;
      const dateTitle = formatHeadingDate(selected);
      const visibleTasks = getVisibleTasks();
      const openCount = visibleTasks.filter((task) => task.status !== "done").length;

      contextEyebrow.textContent = isToday ? "Today" : "Daily record";
      heroTitle.textContent = isToday ? "今日工作" : dateTitle;
      heroCopy.innerHTML = isToday
        ? `<strong class="${openCount > 0 ? "is-active" : ""}">${openCount}</strong> 条任务在推进`
        : "查看当日新增任务";
    }

    function renderStats() {
      const stats = getStats();
      const thirdLabel = state.selectedDate === isoDate(new Date()) ? "今日新增" : "当日新增";
      const items = [
        { label: "进行中", value: stats.inProgress, kind: "in-progress", prev: previousStats.inProgress ?? stats.inProgress },
        { label: "已完成", value: stats.done, kind: "done", prev: previousStats.done ?? stats.done },
        { label: thirdLabel, value: stats.created, kind: "created", prev: previousStats.created ?? stats.created }
      ];

      statsPanel.innerHTML = items.map((item) => `
        <section class="stat-block" data-kind="${item.kind}" data-active="${item.value > 0}">
          <p class="stat-label">${item.label}</p>
          <p class="stat-value">
            <span class="stat-swap ${item.prev !== item.value ? "is-changing" : ""}" aria-hidden="true">
              <span class="stat-swap-current">${item.prev}</span>
              <span class="stat-swap-next">${item.value}</span>
            </span>
          </p>
        </section>
      `).join("");

      previousStats = { ...stats };
    }

    function renderTaskList() {
      const visibleTasks = getVisibleTasks();
      const tasks = applyFilterAndCollapse(visibleTasks);
      if (editingTaskId && !tasks.some((task) => task.id === editingTaskId)) {
        clearEditorState();
      }
      taskCount.textContent = `共 ${visibleTasks.length} 条`;
      taskList.classList.toggle("is-entering", shouldAnimateTaskList);

      toggleCompleted.classList.toggle("is-active", state.collapseCompleted);
      toggleCompleted.textContent = state.collapseCompleted ? "已折叠" : "已展开";

      if (!tasks.length) {
        if (!getTaskById(editingTaskId) || !visibleTasks.some((task) => task.id === editingTaskId)) {
          clearEditorState();
        }
        taskList.innerHTML = `
          <section class="empty-state">
            <h4 class="empty-title">暂无任务</h4>
          </section>
        `;
        shouldAnimateTaskList = false;
        return;
      }

      taskList.innerHTML = tasks.map((task) => {
        const dateLabel = getTaskDateLabel(task, state.selectedDate);
        const doneClass = task.status === "done" ? "is-done" : "";
        const isDeleteArmed = pendingDeleteTaskId === task.id;
        const titleValue = escapeHtml(task.title);
        const isEditing = editingTaskId === task.id && editorDraft;
        const statusMeta = task.status === "done"
          ? ""
          : `<span class="status-badge" data-status="${task.status}">${statusLabel(task.status)}</span>`;
        return `
          <article class="task-item ${doneClass} ${isEditing ? "is-editing" : ""}" data-task-id="${task.id}" style="--stagger-index:${tasks.indexOf(task)}">
            <div class="task-main">
              <div class="task-status">
                <button type="button" class="task-status-button" data-cycle-status aria-label="切换任务状态">
                  ${renderStatusGlyph(task.status)}
                </button>
              </div>
              <div class="task-body">
                <h4 class="task-title ${doneClass}">${titleValue}</h4>
                <div class="task-meta">
                  ${statusMeta}
                  <span class="meta-tag meta-priority" data-priority="${task.priority}">
                    <span class="meta-priority-value">
                      <span class="meta-priority-dot" aria-hidden="true"></span>
                      <span>${priorityLabel(task.priority)}</span>
                    </span>
                  </span>
                  <span class="meta-tag">${dateLabel}</span>
                </div>
              </div>
              <div class="task-actions">
                <button type="button" class="text-button" data-edit aria-label="${isEditing ? "收起编辑" : "编辑任务"}">${isEditing ? "收起" : "编辑"}</button>
                ${isDeleteArmed ? `
                  <div class="confirm-actions">
                    <button type="button" class="confirm-button" data-cancel-delete>取消</button>
                    <button type="button" class="confirm-button is-danger" data-confirm-delete>确认删除</button>
                  </div>
                ` : `
                  <button type="button" class="text-button danger-button" data-delete aria-label="删除任务">删除</button>
                `}
              </div>
            </div>
          </article>
        `;
      }).join("");

      bindTaskEvents();
      if (shouldAnimateTaskList) {
        requestAnimationFrame(() => {
          taskList.classList.remove("is-entering");
        });
      }
      shouldAnimateTaskList = false;
    }

    function toggleCompletedTasks() {
      if (isCollapsingCompleted) return;
      triggerCollapsePillBounce();

      if (state.collapseCompleted) {
        state.collapseCompleted = false;
        shouldAnimateTaskList = true;
        renderTaskList();
        persistState();
        return;
      }

      const doneItems = Array.from(taskList.querySelectorAll(".task-item.is-done"));
      if (!doneItems.length) {
        state.collapseCompleted = true;
        shouldAnimateTaskList = false;
        renderTaskList();
        persistState();
        return;
      }

      isCollapsingCompleted = true;
      doneItems.forEach((item) => item.classList.add("is-leaving-done"));

      window.setTimeout(() => {
        state.collapseCompleted = true;
        shouldAnimateTaskList = false;
        renderTaskList();
        persistState();
        isCollapsingCompleted = false;
      }, 300);
    }

    function triggerCollapsePillBounce() {
      toggleCompleted.classList.remove("is-bouncing");
      void toggleCompleted.offsetWidth;
      toggleCompleted.classList.add("is-bouncing");
      window.setTimeout(() => {
        toggleCompleted.classList.remove("is-bouncing");
      }, 360);
    }

    function bindTaskEvents() {
      taskList.querySelectorAll("[data-task-id]").forEach((item) => {
        const taskId = item.dataset.taskId;

        item.querySelector("[data-cycle-status]")?.addEventListener("click", () => {
          updateTask(taskId, { status: nextStatus(getTaskById(taskId)?.status || "todo") });
        });

        item.querySelector("[data-edit]").addEventListener("click", () => {
          if (editingTaskId === taskId) {
            closeEditor(true);
            return;
          }
          openEditor(taskId);
        });

        item.querySelector("[data-delete]")?.addEventListener("click", () => {
          pendingDeleteTaskId = taskId;
          renderTaskList();
        });

        item.querySelector("[data-cancel-delete]")?.addEventListener("click", () => {
          pendingDeleteTaskId = null;
          renderTaskList();
        });

        item.querySelector("[data-confirm-delete]")?.addEventListener("click", () => {
          state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
          pendingDeleteTaskId = null;
          if (editingTaskId === taskId) {
            closeEditor(false);
          }
          render();
          persistState();
        });
      });
    }

    function renderEditorPanel() {
      const isOpen = Boolean(editingTaskId && editorDraft);
      workspaceBody.dataset.editorOpen = isOpen ? "true" : "false";

      if (!isOpen) {
        editorPanel.innerHTML = "";
        return;
      }

      const task = getTaskById(editingTaskId);
      const createdLine = task ? `📅 创建于 ${formatTaskTimestamp(task.createdAt)}` : "";
      const completedLine = task && task.status === "done" && task.completedAt
        ? `✅ 完成于 ${formatTaskTimestamp(task.completedAt)}`
        : "";

      editorPanel.innerHTML = `
        <div class="editor-panel-card">
          <div class="editor-panel-head">
            <h4 class="editor-panel-title">编辑任务</h4>
            <button class="editor-close" type="button" data-close-editor aria-label="关闭编辑">✕</button>
          </div>
          <div class="editor-panel-body">
            <section class="editor-field editor-field--title">
              <textarea class="editor-title-input" rows="1" maxlength="120" data-editor-title>${escapeHtml(editorDraft.title)}</textarea>
            </section>
            <section class="editor-field editor-field--priority">
              <p class="editor-label">优先级</p>
              <div class="priority-group" data-editor-priority>
                ${priorities.map((priority) => `
                  <button type="button" class="priority-chip ${priority.value === editorDraft.priority ? "is-active" : ""}" data-editor-priority-choice="${priority.value}" data-priority-value="${priority.value}">
                    ${priority.label}
                  </button>
                `).join("")}
              </div>
            </section>
          </div>
          <div class="editor-panel-actions">
            <div class="editor-activity">
              ${createdLine ? `<p class="editor-activity-line">${createdLine}</p>` : ""}
              ${completedLine ? `<p class="editor-activity-line">${completedLine}</p>` : ""}
            </div>
            <button type="button" class="primary-button" data-save-editor>保存</button>
          </div>
        </div>
      `;

      bindEditorPanelEvents();
    }

    function addTask() {
      const title = newTaskTitle.value.trim();
      if (!title) {
        newTaskTitle.focus();
        return;
      }

      const task = {
        id: generateTaskId(),
        title,
        priority: state.composerPriority,
        status: "todo",
        createdAt: formatDateTimeValue(new Date()),
        completedAt: null
      };

      state.tasks.push(task);
      newTaskTitle.value = "";
      shouldAnimateTaskList = true;
      render();
      persistState();
      newTaskTitle.focus();
    }

    function updateTask(taskId, patch, rerender = true) {
      const task = state.tasks.find((entry) => entry.id === taskId);
      if (!task) return;
      const previousStatus = task.status;
      Object.assign(task, patch);
      if (patch.status === "done" && previousStatus !== "done") {
        task.completedAt = formatDateTimeValue(new Date());
      }
      if (patch.status && patch.status !== "done" && previousStatus === "done") {
        task.completedAt = null;
      }
      if (!task.title) task.title = "未命名任务";
      if (rerender) {
        render();
      }
      persistState();
    }

    function openEditor(taskId) {
      const task = getTaskById(taskId);
      if (!task) return;
      pendingDeleteTaskId = null;
      editingTaskId = taskId;
      editorDraft = {
        title: task.title,
        priority: task.priority
      };
      renderTaskList();
      renderEditorPanel();
    }

    function closeEditor(restoreDraft = true) {
      if (restoreDraft && editingTaskId) {
        const task = getTaskById(editingTaskId);
        if (task) {
          editorDraft = {
            title: task.title,
            priority: task.priority
          };
        }
      }
      clearEditorState();
      renderTaskList();
      renderEditorPanel();
    }

    function clearEditorState() {
      editingTaskId = null;
      editorDraft = null;
    }

    function generateTaskId() {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      const randomPart = Math.random().toString(36).slice(2, 10);
      return `task-${Date.now()}-${randomPart}`;
    }

    function saveEditorChanges() {
      if (!editingTaskId || !editorDraft) return;
      updateTask(editingTaskId, {
        title: editorDraft.title.trim() || "未命名任务",
        priority: editorDraft.priority
      }, true);
      closeEditor(false);
    }

    function autoResizeEditorTitle(element) {
      if (!element) return;
      element.style.height = "0px";
      element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
    }

    function formatTaskTimestamp(value) {
      if (!value) return "";
      const normalized = normalizeDateTimeValue(value);
      const [datePart, timePart = "00:00:00"] = normalized.split(" ");
      const [hours = "00", minutes = "00"] = timePart.split(":");
      return `${formatCompactDate(datePart)} ${hours}:${minutes}`;
    }

    function bindEditorPanelEvents() {
      const titleInput = editorPanel.querySelector("[data-editor-title]");
      if (titleInput) {
        autoResizeEditorTitle(titleInput);
        titleInput.addEventListener("input", (event) => {
          editorDraft.title = event.target.value.trimStart();
          autoResizeEditorTitle(event.target);
        });
      }

      editorPanel.querySelector("[data-close-editor]")?.addEventListener("click", () => {
        closeEditor(true);
      });

      editorPanel.querySelectorAll("[data-editor-priority-choice]").forEach((button) => {
        button.addEventListener("click", () => {
          editorDraft.priority = button.dataset.editorPriorityChoice;
          renderEditorPanel();
        });
      });

      editorPanel.querySelector("[data-save-editor]")?.addEventListener("click", () => {
        saveEditorChanges();
      });
    }

    function getVisibleTasks() {
      const today = isoDate(new Date());
      const selected = state.selectedDate;
      const tasks = state.tasks.filter((task) => {
        if (selected === today) {
          return taskDatePart(task.createdAt) === today || taskDatePart(task.completedAt) === today || task.status !== "done";
        }
        return taskDatePart(task.createdAt) === selected || taskDatePart(task.completedAt) === selected;
      });

      return tasks.sort((left, right) => {
        const statusDiff = statusOrder[left.status] - statusOrder[right.status];
        if (statusDiff !== 0) return statusDiff;
        const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return left.createdAt.localeCompare(right.createdAt);
      });
    }

    function getTaskById(taskId) {
      return state.tasks.find((task) => task.id === taskId) || null;
    }

    function applyFilterAndCollapse(tasks) {
      return tasks.filter((task) => {
        if (state.collapseCompleted && task.status === "done") return false;
        if (state.filter === "all") return true;
        return task.status === state.filter;
      });
    }

    function getStats() {
      const selected = state.selectedDate;
      const today = isoDate(new Date());
      const baseTasks = selected === today
        ? getVisibleTasks()
        : state.tasks.filter((task) => taskDatePart(task.createdAt) === selected || taskDatePart(task.completedAt) === selected);
      return {
        inProgress: baseTasks.filter((task) => task.status === "in-progress").length,
        done: baseTasks.filter((task) => task.status === "done").length,
        created: state.tasks.filter((task) => taskDatePart(task.createdAt) === selected).length
      };
    }

    function hasRecord(date) {
      return state.tasks.some((task) => taskDatePart(task.createdAt) === date || taskDatePart(task.completedAt) === date);
    }

    function hasOpenTask(date) {
      return state.tasks.some((task) => taskDatePart(task.createdAt) === date && task.status !== "done");
    }

    function priorityLabel(priority) {
      const entry = priorities.find((item) => item.value === priority);
      return entry ? entry.label : "中";
    }

    function statusLabel(status) {
      const entry = statuses.find((item) => item.value === status);
      if (entry) return entry.label;
      if (status === "need-help") return "需帮助";
      if (status === "failed") return "失败";
      return "待开始";
    }

    function nextStatus(status) {
      const flow = ["todo", "in-progress", "done"];
      const currentIndex = flow.indexOf(status);
      return flow[(currentIndex + 1) % flow.length] || "todo";
    }

    function renderStatusGlyph(status) {
      if (status === "done") {
        return `<span class="task-status-glyph is-done">✓</span>`;
      }
      if (status === "in-progress") {
        return `<span class="task-status-glyph is-progress"></span>`;
      }
      if (status === "need-help") {
        return `<span class="task-status-glyph is-help">!</span>`;
      }
      if (status === "failed") {
        return `<span class="task-status-glyph is-failed">×</span>`;
      }
      return `<span class="task-status-glyph is-todo"></span>`;
    }

    function formatCompactDate(value) {
      const [year, month, day] = value.split("-");
      return `${year}.${month}.${day}`;
    }

    function normalizeDateTimeValue(value, stamp = null) {
      if (typeof value === "string" && value.length >= 19) {
        return value.slice(0, 19).replace("T", " ");
      }
      if (typeof value === "string" && value.length >= 16) {
        return `${value.slice(0, 16).replace("T", " ")}:00`;
      }
      if (typeof stamp === "number" && stamp > 1000000000000) {
        return formatDateTimeValue(new Date(stamp));
      }
      if (typeof value === "string" && value.length === 10) {
        return `${value} 00:00:00`;
      }
      return "";
    }

    function formatDateTimeValue(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    }

    function taskDatePart(value) {
      const normalized = normalizeDateTimeValue(value);
      return normalized ? normalized.slice(0, 10) : "";
    }

    function formatMonthDisplay(year, month) {
      return new Intl.DateTimeFormat("en-US", {
        month: "long"
      }).format(new Date(year, month, 1));
    }

    function startOfMonthGrid(date) {
      const result = new Date(date);
      result.setDate(1);
      const weekday = (result.getDay() + 6) % 7;
      result.setDate(result.getDate() - weekday);
      return result;
    }

    function shiftSelectedDateByMonth(value, amount) {
      const [yearString, monthString, dayString] = value.split("-");
      const desiredDay = Number(dayString);
      const target = new Date(Number(yearString), Number(monthString) - 1 + amount, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(desiredDay, lastDay));
      return isoDate(target);
    }

    function formatFullDate(value) {
      const [year, month, day] = value.split("-");
      return `${year}年${Number(month)}月${Number(day)}日`;
    }

    function getTaskDateLabel(task, selectedDate) {
      if (task.status === "done" && task.completedAt) {
        return `完成于 ${formatCompactDate(taskDatePart(task.completedAt))}`;
      }
      return `创建于 ${formatCompactDate(taskDatePart(task.createdAt))}`;
    }

    function serializeTask(task) {
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        created_at: task.createdAt,
        completed_at: task.completedAt ?? null
      };
    }

    function deserializeTask(task) {
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        createdAt: normalizeDateTimeValue(task.created_at ?? task.createdAt, task.created_stamp ?? task.createdStamp ?? null),
        completedAt: normalizeDateTimeValue(task.completed_at ?? task.completedAt, task.completed_stamp ?? task.completedStamp ?? null) || null
      };
    }

    function formatHeadingDate(value) {
      const date = new Date(`${value}T00:00:00`);
      return new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric"
      }).format(date).replace("/", "月") + "日";
    }

    function isoDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function handleTaskListScroll() {
      taskList.classList.add("is-scrolling");
      clearTimeout(handleTaskListScroll.timer);
      handleTaskListScroll.timer = setTimeout(() => {
        taskList.classList.remove("is-scrolling");
      }, 420);
    }

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }
  return () => {
    taskList?.removeEventListener("scroll", handleTaskListScroll);
    if (saveTimer) { clearTimeout(saveTimer); }
  };
}
