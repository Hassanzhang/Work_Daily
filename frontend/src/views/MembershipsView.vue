<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import DatePickerLume from "../components/DatePickerLume.vue";

const MEMBERSHIPS_API = "/api/memberships";
const filters = [
  { value: "all", label: "全部" },
  { value: "active", label: "存续期间" },
  { value: "expiring", label: "即将到期" },
  { value: "expired", label: "已过期" }
];

const memberships = ref([]);
const currentFilter = ref("all");
const editingId = ref(null);
const syncPending = ref(false);
const composerMetaField = ref(null);

const composer = reactive({
  name: "",
  endDate: "",
  startDate: "",
  price: "",
  note: ""
});

const editorDraft = reactive({
  name: "",
  startDate: "",
  endDate: "",
  price: "",
  note: ""
});

onMounted(() => {
  hydrateMemberships();
});

const filteredMemberships = computed(() => {
  const source = memberships.value.slice().sort((left, right) => {
    return left.end_date.localeCompare(right.end_date) || left.name.localeCompare(right.name);
  });
  if (currentFilter.value === "all") return source;
  return source.filter((item) => item.status === currentFilter.value);
});

const urgentMemberships = computed(() =>
  memberships.value
    .filter((item) => item.status !== "active")
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "expiring" ? -1 : 1;
      }
      return left.end_date.localeCompare(right.end_date);
    })
    .slice(0, 3)
);

const summary = computed(() => ({
  total: memberships.value.length,
  expiring: memberships.value.filter((item) => item.status === "expiring").length,
  expired: memberships.value.filter((item) => item.status === "expired").length
}));

function hydrateEditor(member) {
  editorDraft.name = member.name;
  editorDraft.startDate = member.start_date;
  editorDraft.endDate = member.end_date;
  editorDraft.price = member.price ?? "";
  editorDraft.note = member.note ?? "";
}

function openEditor(member) {
  editingId.value = member.id;
  hydrateEditor(member);
}

function closeEditor() {
  editingId.value = null;
}

function resetComposer() {
  composer.name = "";
  composer.endDate = "";
  composer.startDate = "";
  composer.price = "";
  composer.note = "";
  composerMetaField.value = null;
}

watch(
  () => composer.startDate,
  (value) => {
    if (value && composerMetaField.value === "startDate") {
      composerMetaField.value = null;
    }
  }
);

async function hydrateMemberships() {
  try {
    const response = await fetch(MEMBERSHIPS_API, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Failed to load memberships: ${response.status}`);
    }
    const data = await response.json();
    memberships.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(error);
  }
}

async function syncMemberships() {
  syncPending.value = true;
  try {
    const response = await fetch(MEMBERSHIPS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        memberships.value.map((item) => ({
          id: item.id,
          name: item.name,
          start_date: item.start_date,
          end_date: item.end_date,
          price: item.price || null,
          note: item.note || null
        }))
      )
    });
    if (!response.ok) {
      throw new Error(`Failed to sync memberships: ${response.status}`);
    }
    await hydrateMemberships();
  } catch (error) {
    console.error(error);
  } finally {
    syncPending.value = false;
  }
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `membership-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function addMembership() {
  const name = composer.name.trim();
  const endDate = composer.endDate;
  if (!name || !endDate) return;
  memberships.value.push({
    id: generateId(),
    name,
    start_date: composer.startDate || todayIso(),
    end_date: endDate,
    price: composer.price.trim(),
    note: composer.note.trim()
  });
  resetComposer();
  await syncMemberships();
}

async function saveEditor(memberId) {
  const target = memberships.value.find((item) => item.id === memberId);
  if (!target) return;
  target.name = editorDraft.name.trim() || target.name;
  target.start_date = editorDraft.startDate || target.start_date;
  target.end_date = editorDraft.endDate || target.end_date;
  target.price = editorDraft.price.trim();
  target.note = editorDraft.note.trim();
  closeEditor();
  await syncMemberships();
}

async function removeMembership(memberId) {
  memberships.value = memberships.value.filter((item) => item.id !== memberId);
  if (editingId.value === memberId) closeEditor();
  await syncMemberships();
}

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function formatPrice(value) {
  return value ? `¥${value}` : "未填写价格";
}

function statusLabel(status) {
  if (status === "expiring") return "即将到期";
  if (status === "expired") return "已过期";
  return "存续期间";
}

function remainingLabel(item) {
  if (item.status === "expired") {
    return `已过期 ${Math.abs(item.days_remaining)} 天`;
  }
  if (item.status === "expiring") {
    return `还剩 ${item.days_remaining} 天`;
  }
  return `还剩 ${item.days_remaining} 天`;
}

function progressValue(item) {
  return `${Math.max(0, Math.min(100, item.progress_percent ?? 0))}%`;
}

function openComposerMeta(field) {
  composerMetaField.value = field;
}

function closeComposerMeta(field) {
  if (composerMetaField.value === field) {
    composerMetaField.value = null;
  }
}

function submitComposerMeta(field) {
  if (field === "price") {
    composer.price = composer.price.trim();
  }
  if (field === "note") {
    composer.note = composer.note.trim();
  }
  closeComposerMeta(field);
}

function composerNoteLabel() {
  if (!composer.note.trim()) return "添加备注...";
  return composer.note.trim().length > 18 ? `${composer.note.trim().slice(0, 18)}...` : composer.note.trim();
}
</script>

<template>
  <div class="app-shell membership-app-shell">
    <aside class="sidebar membership-sidebar">
      <section class="brand-block">
        <p class="eyebrow">Membership tracker</p>
        <h1 class="brand-title">Member Expiry</h1>
        <p class="brand-copy">记录会员周期，提前感知到期节点。</p>
      </section>

      <section class="membership-summary-card">
        <div class="membership-summary-head">
          <p class="eyebrow">Overview</p>
          <h2 class="membership-summary-title">会员总览</h2>
        </div>
        <div class="membership-summary-grid">
          <article class="summary-metric">
            <span class="summary-metric-label">总会员数</span>
            <strong class="summary-metric-value">{{ summary.total }}</strong>
          </article>
          <article class="summary-metric">
            <span class="summary-metric-label">即将到期</span>
            <strong class="summary-metric-value is-warning">{{ summary.expiring }}</strong>
          </article>
          <article class="summary-metric">
            <span class="summary-metric-label">已过期</span>
            <strong class="summary-metric-value is-muted">{{ summary.expired }}</strong>
          </article>
        </div>
      </section>

      <section class="membership-alert-card">
        <div class="membership-alert-head">
          <p class="eyebrow">Next up</p>
          <h3 class="membership-alert-title">即将到期提醒</h3>
        </div>
        <div v-if="urgentMemberships.length" class="membership-alert-list">
          <article
            v-for="item in urgentMemberships"
            :key="item.id"
            class="membership-alert-item"
            :data-status="item.status"
          >
            <div class="membership-alert-name">{{ item.name }}</div>
            <div class="membership-alert-meta">{{ remainingLabel(item) }}</div>
          </article>
        </div>
        <p v-else class="membership-alert-empty">当前所有会员状态良好，右侧可以继续新增新的订阅记录。</p>
      </section>

      <section class="stats-panel membership-stats-panel">
        <article class="stat-block" data-active="true" data-kind="in-progress">
          <p class="stat-label">正常存续</p>
          <p class="stat-value">{{ summary.total - summary.expiring - summary.expired }}</p>
        </article>
        <article class="stat-block" :data-active="summary.expiring > 0" data-kind="created">
          <p class="stat-label">即将到期</p>
          <p class="stat-value">{{ summary.expiring }}</p>
        </article>
        <article class="stat-block" :data-active="summary.expired > 0" data-kind="done">
          <p class="stat-label">已过期</p>
          <p class="stat-value">{{ summary.expired }}</p>
        </article>
      </section>
    </aside>

    <main class="workspace membership-workspace">
      <header class="page-head membership-head">
        <div class="title-row">
          <div class="title-stack">
            <p class="eyebrow">Memberships</p>
            <h2 class="hero-title">会员到期</h2>
            <p class="hero-copy">管理订阅周期，查看剩余时间和生命周期进度。</p>
          </div>
        </div>

        <section class="add-shell membership-composer" aria-label="新增会员">
          <div class="add-row membership-add-row">
            <div class="composer-title">
              <input v-model="composer.name" type="text" maxlength="120" placeholder="会员名称，例如 ChatGPT Plus" />
            </div>
            <DatePickerLume v-model="composer.endDate" placeholder="到期日期" />
            <button class="primary-button" type="button" :disabled="syncPending" @click="addMembership">
              新增会员
            </button>
          </div>

          <div class="membership-meta-row" aria-label="会员附加信息">
            <div class="membership-meta-slot">
              <template v-if="composerMetaField === 'price'">
                <label class="membership-meta-editor membership-meta-editor--price">
                  <span class="membership-meta-editor-prefix">¥</span>
                  <input
                    v-model="composer.price"
                    type="text"
                    maxlength="32"
                    placeholder="价格"
                    @keydown.enter.prevent="submitComposerMeta('price')"
                    @blur="submitComposerMeta('price')"
                  />
                </label>
              </template>
              <button v-else type="button" class="membership-meta-chip" @click="openComposerMeta('price')">
                <span class="membership-meta-chip-plus">+</span>
                <span>{{ composer.price.trim() ? `¥${composer.price.trim()}` : "价格" }}</span>
              </button>
            </div>

            <div class="membership-meta-slot">
              <template v-if="composerMetaField === 'startDate'">
                <DatePickerLume v-model="composer.startDate" placeholder="选择开通日期" />
              </template>
              <button v-else type="button" class="membership-meta-chip" @click="openComposerMeta('startDate')">
                <span class="membership-meta-chip-plus">+</span>
                <span>{{ composer.startDate ? formatDate(composer.startDate) : "开通日期" }}</span>
              </button>
            </div>

            <div class="membership-meta-slot membership-meta-slot--note">
              <template v-if="composerMetaField === 'note'">
                <label class="membership-meta-editor membership-meta-editor--note">
                  <input
                    v-model="composer.note"
                    type="text"
                    maxlength="240"
                    placeholder="账号归属、购买渠道等"
                    @keydown.enter.prevent="submitComposerMeta('note')"
                    @blur="submitComposerMeta('note')"
                  />
                </label>
              </template>
              <button v-else type="button" class="membership-meta-chip" @click="openComposerMeta('note')">
                <span class="membership-meta-chip-plus">+</span>
                <span>{{ composerNoteLabel() }}</span>
              </button>
            </div>
          </div>
        </section>
      </header>

      <section class="membership-list-shell">
        <div class="section-row">
          <div class="section-heading">
            <h3 class="section-title">会员清单</h3>
            <span class="section-count">共 {{ memberships.length }} 条</span>
          </div>
          <div class="filter-group">
            <button
              v-for="item in filters"
              :key="item.value"
              type="button"
              class="filter-chip"
              :class="{ 'is-active': currentFilter === item.value }"
              @click="currentFilter = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="membership-list">
          <article
            v-for="item in filteredMemberships"
            :key="item.id"
            class="membership-item"
            :class="{ 'is-editing': editingId === item.id, 'is-expired': item.status === 'expired' }"
          >
            <div class="membership-item-main">
              <div class="membership-item-header">
                <div class="membership-item-title-group">
                  <div class="membership-item-title">{{ item.name }}</div>
                  <div class="membership-item-meta">
                    <span class="status-badge" :data-status="item.status">{{ statusLabel(item.status) }}</span>
                    <span class="meta-tag">{{ remainingLabel(item) }}</span>
                  </div>
                </div>
                <div v-if="item.price" class="membership-item-price">{{ formatPrice(item.price) }}</div>
                <div class="task-actions membership-actions">
                  <button type="button" class="text-button" @click="editingId === item.id ? closeEditor() : openEditor(item)">
                    {{ editingId === item.id ? "收起" : "编辑" }}
                  </button>
                  <button type="button" class="text-button danger-button" @click="removeMembership(item.id)">删除</button>
                </div>
              </div>
              <div class="membership-item-timeline">
                <div class="membership-item-dates">
                  <span>{{ formatDate(item.start_date) }}</span>
                  <span>—</span>
                  <span>{{ formatDate(item.end_date) }}</span>
                </div>
                <div class="membership-progress-inline">
                  <div class="membership-progress-track">
                    <div
                      class="membership-progress-fill"
                      :data-status="item.status"
                      :style="{ transform: `translateX(-${100 - Math.max(0, Math.min(100, item.progress_percent ?? 0))}%)` }"
                    ></div>
                  </div>
                  <span class="membership-progress-value">{{ progressValue(item) }}</span>
                </div>
              </div>
            </div>

            <transition name="membership-editor">
              <div v-if="editingId === item.id" class="membership-editor">
                <div class="membership-editor-grid">
                  <label class="membership-field">
                    <span class="membership-field-label">会员名称</span>
                    <input v-model="editorDraft.name" type="text" maxlength="120" />
                  </label>
                  <DatePickerLume v-model="editorDraft.startDate" label="开通日期" placeholder="选择开通日期" />
                  <DatePickerLume v-model="editorDraft.endDate" label="到期日期" placeholder="选择到期日期" />
                  <label class="membership-field">
                    <span class="membership-field-label">价格</span>
                    <input v-model="editorDraft.price" type="text" maxlength="32" />
                  </label>
                  <label class="membership-field membership-field--full">
                    <span class="membership-field-label">备注</span>
                    <textarea v-model="editorDraft.note" rows="3" maxlength="240"></textarea>
                  </label>
                </div>
                <div class="membership-editor-actions">
                  <button class="soft-button" type="button" @click="closeEditor">取消</button>
                  <button class="primary-button" type="button" @click="saveEditor(item.id)">保存</button>
                </div>
              </div>
            </transition>
          </article>

          <section v-if="!filteredMemberships.length" class="empty-state membership-empty">
            <h4 class="empty-title">暂无会员记录</h4>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.membership-app-shell {
  align-items: stretch;
}

.membership-sidebar {
  gap: 16px;
}

.membership-summary-card,
.membership-alert-card {
  padding: 18px 20px;
  background: linear-gradient(180deg, oklch(99.2% 0.004 228), oklch(97.8% 0.006 228 / 0.94));
  border: 1px solid oklch(100% 0 0 / 0.72);
  border-radius: 20px;
  box-shadow: var(--shadow);
}

.membership-summary-head,
.membership-alert-head {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
}

.membership-summary-title,
.membership-alert-title {
  margin: 0;
  font-size: 20px;
  line-height: 1.1;
  font-weight: 660;
  letter-spacing: -0.03em;
}

.membership-summary-grid {
  display: grid;
  gap: 8px;
}

.summary-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: 0;
}

.summary-metric-label {
  color: var(--text-soft);
  font-size: 13px;
}

.summary-metric-value {
  font-size: 30px;
  font-weight: 760;
}

.summary-metric-value.is-warning {
  color: #ea580c;
}

.summary-metric-value.is-muted {
  color: oklch(62% 0.008 228);
}

.membership-alert-list {
  display: grid;
  gap: 8px;
}

.membership-alert-item {
  display: grid;
  gap: 4px;
  padding: 11px 13px;
  border-radius: 14px;
  background: oklch(99.2% 0.004 224 / 0.88);
  border: 1px solid oklch(92% 0.008 228);
}

.membership-alert-item[data-status="expiring"] {
  background: oklch(97% 0.02 52 / 0.72);
}

.membership-alert-item[data-status="expired"] {
  background: oklch(95% 0.01 28 / 0.6);
}

.membership-alert-name {
  font-size: 14px;
  font-weight: 620;
}

.membership-alert-meta,
.membership-alert-empty {
  margin: 0;
  color: var(--text-soft);
  font-size: 13px;
  line-height: 1.45;
}

.membership-stats-panel {
  margin-top: 0;
}

.membership-workspace {
  padding-bottom: 26px;
}

.membership-head {
  margin-bottom: 34px;
}

.membership-composer {
  gap: 12px;
  margin-bottom: 6px;
  padding: 14px 14px 12px;
  border: 1px solid oklch(92% 0.008 228 / 0.82);
  border-radius: 24px;
  background: linear-gradient(180deg, oklch(99.55% 0.003 228 / 0.96), oklch(98.1% 0.005 228 / 0.94));
  box-shadow:
    inset 0 1px 0 oklch(100% 0 0 / 0.76),
    0 14px 26px oklch(28% 0.014 240 / 0.032);
}

.membership-add-row {
  grid-template-columns: minmax(0, 1fr) 232px auto;
  align-items: stretch;
  gap: 12px;
}

.membership-field {
  display: grid;
  gap: 6px;
}

.membership-field-label {
  font-size: 11px;
  color: var(--text-soft);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.membership-field input,
.membership-field textarea {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: oklch(99.5% 0.003 224 / 0.96);
  padding: 10px 12px;
  font: inherit;
  color: var(--text);
  outline: none;
}

.membership-composer input::placeholder,
.membership-field input::placeholder,
.membership-field textarea::placeholder {
  color: #b4b4ba;
  font-weight: 400;
}

.membership-field textarea {
  min-height: 112px;
  resize: vertical;
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.03);
}

.membership-field input:focus,
.membership-field textarea:focus {
  border-color: oklch(86% 0.03 230);
  box-shadow: 0 0 0 4px oklch(94% 0.02 230 / 0.55);
}

.membership-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 16px;
  padding-top: 12px;
}

.membership-field--full {
  grid-column: 1 / -1;
}

.membership-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 2px 0 2px;
}

.membership-meta-slot {
  min-width: 0;
  flex: 0 0 auto;
}

.membership-meta-slot--note {
  flex: 0 0 auto;
}

.membership-meta-chip {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border-radius: 999px;
  background: oklch(98.1% 0.004 228 / 0.88);
  color: rgb(0 0 0 / 0.46);
  border: 1px solid oklch(91.8% 0.008 228 / 0.88);
  font-size: 12px;
  font-weight: 520;
  transition:
    border-color var(--motion-swift) var(--ease-out-quad),
    background-color var(--motion-swift) var(--ease-out-quad),
    color var(--motion-swift) var(--ease-out-quad);
}

.membership-meta-chip:hover {
  color: var(--text);
  border-color: oklch(86% 0.012 228);
  background: oklch(98.6% 0.004 228 / 0.94);
}

.membership-meta-chip-plus {
  color: rgb(0 0 0 / 0.35);
  font-size: 13px;
  font-weight: 640;
}

.membership-meta-editor {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: oklch(99.35% 0.003 228 / 0.96);
  border: 1px solid oklch(90% 0.01 228 / 0.88);
  box-shadow: 0 8px 14px oklch(28% 0.012 240 / 0.032);
  padding: 0 10px;
}

.membership-meta-editor input {
  min-height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: 12px;
}

.membership-meta-editor input:focus {
  box-shadow: none;
  border: 0;
}

.membership-meta-editor--price {
  width: 104px;
}

.membership-meta-editor--note {
  width: 220px;
  min-width: 220px;
}

.membership-meta-editor-prefix {
  color: rgb(0 0 0 / 0.42);
  font-size: 12px;
  font-weight: 600;
}

.membership-list-shell {
  min-height: 0;
  display: flex;
  flex-direction: column;
  max-width: 900px;
  margin-top: 0;
}

.membership-add-row :deep(.lume-field) {
  align-self: stretch;
}

.membership-add-row :deep(.lume-field__trigger) {
  min-height: 46px;
  border: 1px solid oklch(93% 0.008 228 / 0.86);
  border-radius: 16px;
  background: linear-gradient(180deg, oklch(99.7% 0.002 228 / 0.98), oklch(98.8% 0.004 228 / 0.96));
  padding: 0 14px;
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.72);
}

.membership-add-row :deep(.lume-field__trigger:focus-visible) {
  border: 0;
  box-shadow: 0 0 0 4px oklch(94% 0.02 230 / 0.42);
}

.membership-add-row :deep(.lume-field__icon) {
  color: rgb(0 0 0 / 0.28);
}

.membership-meta-slot :deep(.lume-field) {
  width: auto;
}

.membership-meta-slot :deep(.lume-field__trigger) {
  min-height: 32px;
  min-width: 156px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid oklch(90% 0.01 228 / 0.88);
  background: oklch(99.35% 0.003 228 / 0.96);
  box-shadow: 0 8px 14px oklch(28% 0.012 240 / 0.032);
  font-size: 12px;
  color: rgb(0 0 0 / 0.56);
}

.membership-meta-slot :deep(.lume-field__trigger.is-filled),
.membership-meta-slot :deep(.lume-field__trigger:hover),
.membership-meta-slot :deep(.lume-field__trigger:focus-visible) {
  color: var(--text);
}

.membership-meta-slot :deep(.lume-field__icon) {
  width: 14px;
  height: 14px;
  color: rgb(0 0 0 / 0.28);
}

.membership-meta-slot :deep(.lume-panel) {
  width: 340px;
}

.membership-list {
  flex: 0 0 520px;
  min-height: 520px;
  height: 520px;
  border: 1px solid oklch(92% 0.008 228 / 0.92);
  border-radius: 20px;
  background: linear-gradient(180deg, oklch(99.6% 0.003 224 / 0.84), oklch(98.4% 0.004 228 / 0.92));
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable both-edges;
  scrollbar-color: rgb(0 0 0 / 0.16) transparent;
  scrollbar-width: thin;
  box-shadow:
    inset 0 1px 0 oklch(100% 0 0 / 0.56),
    0 12px 22px oklch(28% 0.016 240 / 0.028);
}

.membership-list::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.membership-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 999px;
}

.membership-list::-webkit-scrollbar-thumb {
  background: rgb(0 0 0 / 0.16);
  border-radius: 999px;
  border: 0;
  transition: background-color 300ms ease, opacity 300ms ease;
}

.membership-list:hover::-webkit-scrollbar-thumb {
  background: rgb(0 0 0 / 0.22);
}

.membership-list:hover::-webkit-scrollbar-thumb:hover {
  background: rgb(0 0 0 / 0.3);
}

.membership-item {
  padding: 16px 20px;
  border-bottom: 1px solid oklch(93.8% 0.006 228);
  background: oklch(100% 0 0 / 0.34);
  transition:
    background-color var(--motion-swift) var(--ease-out-quad),
    box-shadow var(--motion-swift) var(--ease-out-quad);
}

.membership-item:last-child {
  border-bottom: 0;
}

.membership-item:hover {
  background: oklch(100% 0 0 / 0.44);
}

.membership-item.is-editing {
  background: oklch(100% 0 0 / 0.48);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.035);
}

.membership-item.is-expired {
  color: oklch(62% 0.008 228);
}

.membership-item-main {
  display: grid;
  gap: 12px;
}

.membership-item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.membership-item-title-group {
  display: grid;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.membership-item-title {
  font-size: 16px;
  font-weight: 640;
  line-height: 1.25;
  color: var(--text);
}

.membership-actions {
  min-width: 88px;
}

.membership-item-price {
  align-self: center;
  white-space: nowrap;
  color: rgb(0 0 0 / 0.58);
  font-size: 13px;
  font-weight: 560;
}

.membership-item-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.membership-item-meta .status-badge,
.membership-item-meta .meta-tag {
  min-height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 620;
}

.membership-item-meta .status-badge[data-status="active"] {
  background: rgb(34 197 94 / 0.08);
  color: #16a34a;
}

.membership-item-meta .status-badge[data-status="expiring"] {
  background: rgb(245 158 11 / 0.08);
  color: #d97706;
}

.membership-item-meta .status-badge[data-status="expired"] {
  background: rgb(120 120 120 / 0.08);
  color: oklch(54% 0.01 228);
}

.membership-item-meta .meta-tag {
  background: rgb(120 120 120 / 0.06);
  color: rgb(0 0 0 / 0.5);
}

.membership-item-meta .meta-tag:first-of-type {
  background: rgb(245 158 11 / 0.08);
  color: #c25c07;
}

.membership-item-timeline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-top: 2px;
}

.membership-progress-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.membership-progress-value {
  color: var(--text-soft);
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.membership-progress-track {
  position: relative;
  height: 8px;
  width: 192px;
  border-radius: 999px;
  background: oklch(95.6% 0.004 228 / 0.96);
  overflow: hidden;
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.55);
  flex: 0 0 192px;
}

.membership-progress-fill {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, oklch(72% 0.23 2), oklch(79% 0.18 55));
  transition: transform var(--motion-smooth) var(--ease-out-quint);
}

.membership-progress-fill[data-status="expiring"] {
  background: linear-gradient(90deg, oklch(72% 0.23 2), oklch(79% 0.18 55));
}

.membership-progress-fill[data-status="expired"] {
  background: linear-gradient(90deg, oklch(80% 0.004 228), oklch(70% 0.004 228));
}

.membership-item-dates {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #a0a0a0;
  font-size: 11px;
  white-space: nowrap;
}

.membership-editor {
  display: grid;
  gap: 22px;
  margin-top: 16px;
  padding: 24px 24px 8px;
  border-top: 1px solid oklch(93% 0.006 228 / 0.7);
  background: oklch(98.95% 0.004 228 / 0.42);
  border-radius: 18px;
}

.membership-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.membership-editor-enter-active,
.membership-editor-leave-active {
  transition:
    opacity 200ms var(--ease-out-quad),
    transform 200ms var(--ease-out-quad);
}

.membership-editor-enter-from,
.membership-editor-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.membership-empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
</style>
