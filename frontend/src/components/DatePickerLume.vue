<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: "" },
  placeholder: { type: String, default: "选择日期" }
});

const emit = defineEmits(["update:modelValue"]);

const rootRef = ref(null);
const isOpen = ref(false);
const step = ref("day");

const today = new Date();
const todayYear = today.getFullYear();
const selectedDate = ref(parseIsoDate(props.modelValue) ?? today);
const selectedYear = ref(selectedDate.value.getFullYear());
const selectedMonth = ref(selectedDate.value.getMonth());

const yearRange = Array.from({ length: 21 }, (_, i) => todayYear - 5 + i);
const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

watch(() => props.modelValue, (value) => {
  const parsed = parseIsoDate(value);
  const source = parsed ?? today;
  selectedDate.value = source;
  selectedYear.value = source.getFullYear();
  selectedMonth.value = source.getMonth();
});

const monthLabel = computed(() =>
  new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(selectedYear.value, selectedMonth.value, 1))
);

const months = computed(() =>
  Array.from({ length: 12 }, (_, index) => ({
    value: index,
    short: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(selectedYear.value, index, 1)),
    year: selectedYear.value
  }))
);

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder;
  return formatDisplayDate(props.modelValue);
});

const dayCells = computed(() => {
  const firstDay = new Date(selectedYear.value, selectedMonth.value, 1);
  const lastDay = new Date(selectedYear.value, selectedMonth.value + 1, 0);
  const leading = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const trailing = (7 - ((leading + totalDays) % 7)) % 7;
  const cells = [];

  for (let i = leading; i > 0; i--) {
    cells.push(makeDayCell(new Date(selectedYear.value, selectedMonth.value, 1 - i), false));
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(makeDayCell(new Date(selectedYear.value, selectedMonth.value, d), true));
  }
  for (let i = 1; i <= trailing; i++) {
    cells.push(makeDayCell(new Date(selectedYear.value, selectedMonth.value + 1, i), false));
  }
  return cells;
});

function makeDayCell(date, inMonth) {
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label: date.getDate(),
    inMonth,
    isToday: isSameDate(date, today),
    isSelected: isSameDate(date, selectedDate.value),
    date
  };
}

function openPicker() {
  isOpen.value = true;
  step.value = "day";
  nextTick(() => {
    const el = rootRef.value?.querySelector(".dp-year-active");
    el?.scrollIntoView?.({ block: "nearest" });
  });
}

function closePicker() { isOpen.value = false; }

function prevMonth() {
  if (selectedMonth.value === 0) {
    selectedMonth.value = 11;
    selectedYear.value--;
  } else {
    selectedMonth.value--;
  }
}

function nextMonth() {
  if (selectedMonth.value === 11) {
    selectedMonth.value = 0;
    selectedYear.value++;
  } else {
    selectedMonth.value++;
  }
}

function selectYearDirect(year) {
  selectedYear.value = year;
  step.value = "month";
}

function selectDate(date) {
  selectedDate.value = date;
  emit("update:modelValue", toIsoDate(date));
  closePicker();
}

function handlePointerDown(event) {
  if (!isOpen.value || !rootRef.value) return;
  if (rootRef.value.contains(event.target)) return;
  closePicker();
}

onMounted(() => document.addEventListener("pointerdown", handlePointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", handlePointerDown));

function parseIsoDate(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplayDate(value) {
  const d = parseIsoDate(value);
  if (!d) return props.placeholder;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
</script>

<template>
  <div ref="rootRef" class="dp-root">
    <!-- Label -->
    <span v-if="label" class="dp-label">{{ label }}</span>

    <!-- Trigger -->
    <button type="button" class="dp-trigger" :class="{ 'dp-trigger--filled': modelValue }" @click="openPicker">
      <span>{{ displayValue }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" class="dp-icon">
        <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 9H4v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7ZM5 6a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H5Z" fill="currentColor"/>
      </svg>
    </button>

    <!-- Panel -->
    <transition name="dp-fade">
      <div v-if="isOpen" class="dp-panel">
        <!-- Header -->
        <div class="dp-head">
          <button type="button" class="dp-head__crumb" :class="{ 'dp-head__crumb--active': step === 'year' }" @click="step = 'year'">年</button>
          <button type="button" class="dp-head__crumb" :class="{ 'dp-head__crumb--active': step === 'month' }" @click="step = 'month'">月</button>
          <button type="button" class="dp-head__crumb" :class="{ 'dp-head__crumb--active': step === 'day' }" @click="step = 'day'">日</button>
        </div>

        <transition name="dp-stage" mode="out-in">
          <!-- Year picker -->
          <div v-if="step === 'year'" key="year" class="dp-stage dp-stage--year">
            <div class="dp-year-grid">
              <button
                v-for="y in yearRange" :key="y"
                type="button"
                class="dp-year-btn"
                :class="{ 'dp-year-btn--active': y === selectedYear, 'dp-year-active': y === todayYear }"
                @click="selectYearDirect(y)"
              >{{ y }}</button>
            </div>
          </div>

          <!-- Month picker -->
          <div v-else-if="step === 'month'" key="month" class="dp-stage">
            <div class="dp-month-grid">
              <button
                v-for="m in months" :key="m.value"
                type="button"
                class="dp-month-btn"
                :class="{ 'dp-month-btn--active': m.value === selectedMonth }"
                @click="selectedMonth = m.value; step = 'day'"
              >
                <span class="dp-month-btn__short">{{ m.short }}</span>
              </button>
            </div>
          </div>

          <!-- Day picker -->
          <div v-else key="day" class="dp-stage">
            <div class="dp-day-head">
              <button type="button" class="dp-nav-btn" aria-label="上一月" @click="prevMonth">‹</button>
              <span class="dp-day-head__title">{{ monthLabel }} {{ selectedYear }}</span>
              <button type="button" class="dp-nav-btn" aria-label="下一月" @click="nextMonth">›</button>
            </div>
            <div class="dp-weekdays">
              <span v-for="w in weekdayLabels" :key="w">{{ w }}</span>
            </div>
            <div class="dp-day-grid">
              <button
                v-for="cell in dayCells" :key="cell.key"
                type="button"
                class="dp-day-btn"
                :class="{
                  'dp-day-btn--muted': !cell.inMonth,
                  'dp-day-btn--today': cell.isToday,
                  'dp-day-btn--selected': cell.isSelected
                }"
                :disabled="!cell.inMonth"
                :aria-label="cell.date"
                @click="selectDate(cell.date)"
              >{{ cell.label }}</button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ── Root ── */
.dp-root { position: relative; display: grid; gap: 4px; }

/* ── Label ── */
.dp-label {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-pencil);
}

/* ── Trigger ── */
.dp-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid var(--color-edge);
  border-radius: var(--r-sm);
  background: var(--color-kraft);
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--color-pencil);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-100) var(--ease-out), color var(--dur-100) var(--ease-out);
}

.dp-trigger:hover { border-color: var(--color-pencil); color: var(--color-ink); }
.dp-trigger--filled { color: var(--color-ink); }
.dp-trigger:focus-visible {
  outline: 2px solid var(--color-vermillion);
  outline-offset: 2px;
}

.dp-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: var(--color-pencil);
  opacity: 0.5;
}

/* ── Panel ── */
.dp-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 24;
  width: 340px;
  padding: 14px;
  background: var(--color-paper);
  border: 1px solid var(--color-edge);
  border-radius: var(--r-md);
  box-shadow: 0 4px 16px rgba(28,28,24,0.08);
}

/* ── Head crumbs ── */
.dp-head {
  display: flex;
  gap: 2px;
  padding: 2px;
  margin-bottom: 14px;
  background: var(--color-kraft);
  border: 1px solid var(--color-edge);
  border-radius: var(--r-sm);
}

.dp-head__crumb {
  flex: 1;
  height: 30px;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 520;
  color: var(--color-pencil);
  cursor: pointer;
  transition: background var(--dur-100) var(--ease-out), color var(--dur-100) var(--ease-out);
}

.dp-head__crumb:hover { color: var(--color-ink); }
.dp-head__crumb--active {
  background: var(--color-paper);
  color: var(--color-ink);
  font-weight: 560;
  box-shadow: 0 1px 2px rgba(28,28,24,0.04);
}

/* ── Stage ── */
.dp-stage { min-height: 260px; }
.dp-stage--year { max-height: 260px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin; scrollbar-color: var(--color-edge) transparent; }

/* ── Year grid ── */
.dp-year-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.dp-year-btn {
  height: 38px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-pencil);
  cursor: pointer;
  transition: background var(--dur-100) var(--ease-out), border-color var(--dur-100) var(--ease-out), color var(--dur-100) var(--ease-out);
}

.dp-year-btn:hover { background: var(--color-kraft); color: var(--color-ink); }
.dp-year-btn--active {
  border-color: var(--color-vermillion);
  background: rgba(178,34,34,0.06);
  color: var(--color-vermillion);
  font-weight: 620;
}

/* ── Month grid ── */
.dp-month-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.dp-month-btn {
  height: 48px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 520;
  color: var(--color-pencil);
  cursor: pointer;
  transition: background var(--dur-100) var(--ease-out), border-color var(--dur-100) var(--ease-out), color var(--dur-100) var(--ease-out);
}

.dp-month-btn:hover { background: var(--color-kraft); color: var(--color-ink); }
.dp-month-btn--active {
  border-color: var(--color-vermillion);
  background: rgba(178,34,34,0.06);
  color: var(--color-vermillion);
  font-weight: 600;
}

.dp-month-btn__short { font-weight: inherit; }

/* ── Day head ── */
.dp-day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.dp-day-head__title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 680;
  letter-spacing: -0.02em;
  color: var(--color-ink);
}

.dp-nav-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-edge);
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--color-pencil);
  font-size: 15px;
  cursor: pointer;
  transition: background var(--dur-100) var(--ease-out), border-color var(--dur-100) var(--ease-out), color var(--dur-100) var(--ease-out);
}

.dp-nav-btn:hover {
  background: rgba(178,34,34,0.06);
  border-color: var(--color-vermillion);
  color: var(--color-vermillion);
}

/* ── Weekdays ── */
.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-edge);
}

.dp-weekdays span {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-pencil);
}

/* ── Day grid ── */
.dp-day-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.dp-day-btn {
  width: 100%;
  aspect-ratio: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: var(--r-full);
  background: transparent;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 460;
  font-variant-numeric: tabular-nums;
  color: var(--color-ink);
  cursor: pointer;
  position: relative;
  transition: border-color var(--dur-100) var(--ease-out), background var(--dur-100) var(--ease-out), color var(--dur-100) var(--ease-out);
}

.dp-day-btn:hover { background: var(--color-kraft); }

.dp-day-btn--muted {
  color: var(--color-edge);
  cursor: default;
  pointer-events: none;
}

.dp-day-btn--muted:disabled {
  opacity: 0.4;
}

.dp-day-btn:focus-visible {
  outline: 2px solid var(--color-vermillion);
  outline-offset: 2px;
}

.dp-day-btn--today {
  font-weight: 620;
}

.dp-day-btn--today:not(.dp-day-btn--selected)::after {
  content: "";
  position: absolute;
  bottom: 3px;
  left: 50%;
  width: 3px;
  height: 3px;
  border-radius: var(--r-full);
  background: var(--color-ink);
  transform: translateX(-50%);
}

.dp-day-btn--selected {
  border-color: var(--color-vermillion);
  color: var(--color-vermillion);
  font-weight: 640;
}

/* ── Transitions ── */
.dp-fade-enter-active,
.dp-fade-leave-active {
  transition: opacity var(--dur-150) var(--ease-out), transform var(--dur-150) var(--ease-out);
}

.dp-fade-enter-from,
.dp-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.dp-stage-enter-active,
.dp-stage-leave-active {
  transition: opacity var(--dur-150) var(--ease-out);
}

.dp-stage-enter-from,
.dp-stage-leave-to {
  opacity: 0;
}
</style>
