<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import DatePickerLume from "../components/DatePickerLume.vue";

/* ── Config ── */
const MEMBERSHIPS_API = "/api/memberships";

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "active", label: "存续期间" },
  { value: "expiring", label: "即将到期" },
  { value: "expired", label: "已过期" }
];

/* ── State ── */
const STORAGE_KEY = "memberships-data-v1";
const memberships = ref([]);
const currentFilter = ref("all");
const editingId = ref(null);
const pendingDeleteId = ref(null);
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

/* ── Lifecycle ── */
onMounted(() => {
  loadState();
  hydrateMemberships();
});

/* ── Computed ── */
const filteredMemberships = computed(() => {
  const source = [...memberships.value].sort((a, b) =>
    (a.end_date || "").localeCompare(b.end_date || "") || a.name.localeCompare(b.name)
  );
  if (currentFilter.value === "all") return source;
  return source.filter((item) => item.status === currentFilter.value);
});

const urgentMemberships = computed(() =>
  memberships.value
    .filter((item) => item.status !== "active")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "expiring" ? -1 : 1;
      return (a.end_date || "").localeCompare(b.end_date || "");
    })
    .slice(0, 3)
);

const summary = computed(() => ({
  total: memberships.value.length,
  expiring: memberships.value.filter((item) => item.status === "expiring").length,
  expired: memberships.value.filter((item) => item.status === "expired").length
}));

/* ── Helpers ── */
function generateId() {
  return crypto?.randomUUID?.() ?? `membership-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${y}.${m}.${d}`;
}

function formatPrice(value) {
  return value ? `¥${value}` : "未填写";
}

function statusLabel(status) {
  if (status === "expiring") return "即将到期";
  if (status === "expired") return "已过期";
  return "存续期间";
}

function remainingLabel(item) {
  if (item.status === "expired") return `已过期 ${Math.abs(item.days_remaining)} 天`;
  return `还剩 ${item.days_remaining} 天`;
}

function progressValue(item) {
  return `${Math.max(0, Math.min(100, item.progress_percent ?? 0))}%`;
}

/* ── Persistence ── */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) memberships.value = parsed;
    }
  } catch { /* ignore */ }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memberships.value));
}

/* ── API ── */
async function hydrateMemberships() {
  try {
    const res = await fetch(MEMBERSHIPS_API, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    memberships.value = Array.isArray(data) ? data : [];
  } catch (e) { console.error(e); }
}

async function syncMemberships() {
  syncPending.value = true;
  try {
    const res = await fetch(MEMBERSHIPS_API, {
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
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    await hydrateMemberships();
  } catch (e) { console.error(e); }
  finally { syncPending.value = false; }
}

/* ── Actions ── */
function openEditor(member) {
  editingId.value = member.id;
  editorDraft.name = member.name;
  editorDraft.startDate = member.start_date;
  editorDraft.endDate = member.end_date;
  editorDraft.price = member.price ?? "";
  editorDraft.note = member.note ?? "";
}

function closeEditor() { editingId.value = null; }

function resetComposer() {
  composer.name = "";
  composer.endDate = "";
  composer.startDate = "";
  composer.price = "";
  composer.note = "";
  composerMetaField.value = null;
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
  pendingDeleteId.value = null;
  persistState();
  await syncMemberships();
}

function openComposerMeta(field) { composerMetaField.value = field; }
function closeComposerMeta(field) { if (composerMetaField.value === field) composerMetaField.value = null; }
function submitComposerMeta(field) {
  if (field === "price") composer.price = composer.price.trim();
  if (field === "note") composer.note = composer.note.trim();
  closeComposerMeta(field);
}

function composerNoteLabel() {
  if (!composer.note.trim()) return "添加备注…";
  const t = composer.note.trim();
  return t.length > 18 ? `${t.slice(0, 18)}…` : t;
}

watch(() => composer.startDate, (val) => {
  if (val && composerMetaField.value === "startDate") composerMetaField.value = null;
});
</script>

<template>
  <div class="app-shell">
    <!-- ── Sidebar ── -->
    <aside class="sidebar">
      <section class="brand-block">
        <p class="eyebrow">MEMBERSHIPS</p>
        <h1 class="brand-title">会员管理</h1>
        <p class="brand-copy">追踪订阅周期，到期前及时续费。</p>
      </section>

      <!-- Summary -->
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

      <!-- Alerts -->
      <section class="membership-alert-card">
        <div class="membership-alert-head">
          <p class="eyebrow">NEXT UP</p>
          <h3 class="membership-alert-title">到期提醒</h3>
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
        <p v-else class="membership-alert-empty">暂无到期会员，一切正常。</p>
      </section>

      <!-- Stats -->
      <section class="stats-panel membership-stats-panel">
        <article class="stat-block" :data-active="summary.total - summary.expiring - summary.expired > 0" data-kind="done">
          <p class="stat-label">正常存续</p>
          <p class="stat-value">{{ summary.total - summary.expiring - summary.expired }}</p>
        </article>
        <article class="stat-block" :data-active="summary.expiring > 0" data-kind="in-progress">
          <p class="stat-label">即将到期</p>
          <p class="stat-value">{{ summary.expiring }}</p>
        </article>
        <article class="stat-block" :data-active="summary.expired > 0" data-kind="created">
          <p class="stat-label">已过期</p>
          <p class="stat-value">{{ summary.expired }}</p>
        </article>
      </section>
    </aside>

    <!-- ── Workspace ── -->
    <main class="workspace">
      <header class="page-head">
        <div class="title-row">
          <div class="title-stack">
            <p class="eyebrow">MEMBERSHIPS</p>
            <h2 class="hero-title">会员列表</h2>
            <p class="hero-copy">管理所有订阅，跟踪到期时间和使用进度。</p>
          </div>
        </div>

        <!-- Composer -->
        <section class="add-shell membership-composer">
          <div class="add-row membership-add-row">
            <div class="composer-title">
              <input v-model="composer.name" type="text" maxlength="120" placeholder="会员名称，例如 ChatGPT Plus" />
            </div>
            <DatePickerLume v-model="composer.endDate" placeholder="到期日期" />
            <button class="primary-button" type="button" :disabled="syncPending" @click="addMembership">
              新增会员
            </button>
          </div>

          <div class="membership-meta-row">
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
              <button v-else class="membership-meta-chip" type="button" @click="openComposerMeta('price')">
                <span class="membership-meta-chip-plus">+</span>
                <span>{{ composer.price.trim() ? `¥${composer.price.trim()}` : "价格" }}</span>
              </button>
            </div>

            <div class="membership-meta-slot">
              <template v-if="composerMetaField === 'startDate'">
                <DatePickerLume v-model="composer.startDate" placeholder="选择开通日期" />
              </template>
              <button v-else class="membership-meta-chip" type="button" @click="openComposerMeta('startDate')">
                <span class="membership-meta-chip-plus">+</span>
                <span>{{ composer.startDate ? formatDate(composer.startDate) : "开通日期" }}</span>
              </button>
            </div>

            <div class="membership-meta-slot">
              <template v-if="composerMetaField === 'note'">
                <label class="membership-meta-editor membership-meta-editor--note">
                  <input
                    v-model="composer.note"
                    type="text"
                    maxlength="240"
                    placeholder="账号、渠道等备注"
                    @keydown.enter.prevent="submitComposerMeta('note')"
                    @blur="submitComposerMeta('note')"
                  />
                </label>
              </template>
              <button v-else class="membership-meta-chip" type="button" @click="openComposerMeta('note')">
                <span class="membership-meta-chip-plus">+</span>
                <span>{{ composerNoteLabel() }}</span>
              </button>
            </div>
          </div>
        </section>
      </header>

      <!-- Membership list -->
      <section class="membership-list-shell">
        <div class="section-row">
          <div class="section-heading">
            <h3 class="section-title">会员清单</h3>
            <span class="section-count">共 {{ memberships.length }} 条</span>
          </div>
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
                    <span class="meta-tag meta-date">{{ remainingLabel(item) }}</span>
                  </div>
                </div>
                <div v-if="item.price" class="membership-item-price">{{ formatPrice(item.price) }}</div>
                <div class="task-actions membership-actions">
                  <button class="text-button" type="button" @click="editingId === item.id ? closeEditor() : openEditor(item)">
                    {{ editingId === item.id ? "收起" : "编辑" }}
                  </button>
                  <template v-if="pendingDeleteId === item.id">
                    <div class="confirm-actions">
                      <button class="confirm-button" type="button" @click="pendingDeleteId = null">取消</button>
                      <button class="confirm-button is-danger" type="button" @click="removeMembership(item.id)">确认删除</button>
                    </div>
                  </template>
                  <button v-else class="text-button danger-button" type="button" @click="pendingDeleteId = item.id">删除</button>
                </div>
              </div>
              <div class="membership-item-timeline">
                <div class="membership-item-dates">
                  <span>{{ formatDate(item.start_date) }}</span>
                  <span> → </span>
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

            <!-- Inline editor -->
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
                    <textarea v-model="editorDraft.note" rows="2" maxlength="240"></textarea>
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
