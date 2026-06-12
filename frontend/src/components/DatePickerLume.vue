<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  label: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: "选择日期"
  }
});

const emit = defineEmits(["update:modelValue"]);

const rootRef = ref(null);
const isOpen = ref(false);
const step = ref("year");

const today = new Date();
const selectedDate = ref(parseIsoDate(props.modelValue) ?? today);
const selectedYear = ref(selectedDate.value.getFullYear());
const selectedMonth = ref(selectedDate.value.getMonth());

const yearRange = Array.from({ length: 201 }, (_, index) => 1900 + index);
const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

watch(
  () => props.modelValue,
  (value) => {
    const parsed = parseIsoDate(value);
    const source = parsed ?? today;
    selectedDate.value = source;
    selectedYear.value = source.getFullYear();
    selectedMonth.value = source.getMonth();
  }
);

const monthLabel = computed(() =>
  new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(selectedYear.value, selectedMonth.value, 1))
);

const months = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const date = new Date(selectedYear.value, index, 1);
    return {
      value: index,
      short: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date),
      year: selectedYear.value
    };
  })
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

  for (let index = leading; index > 0; index -= 1) {
    const date = new Date(selectedYear.value, selectedMonth.value, 1 - index);
    cells.push(makeDayCell(date, false));
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(selectedYear.value, selectedMonth.value, day);
    cells.push(makeDayCell(date, true));
  }

  for (let index = 1; index <= trailing; index += 1) {
    const date = new Date(selectedYear.value, selectedMonth.value + 1, index);
    cells.push(makeDayCell(date, false));
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
  step.value = "year";
}

function closePicker() {
  isOpen.value = false;
}

function selectYear(year) {
  selectedYear.value = year;
  step.value = "month";
}

function selectMonth(month) {
  selectedMonth.value = month;
  step.value = "day";
  selectedDate.value = new Date(selectedYear.value, month, 1);
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

onMounted(() => {
  document.addEventListener("pointerdown", handlePointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
});

function parseIsoDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDisplayDate(value) {
  const parsed = parseIsoDate(value);
  if (!parsed) return props.placeholder;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
</script>

<template>
  <div ref="rootRef" class="lume-field">
    <span v-if="label" class="membership-field-label">{{ label }}</span>
    <button type="button" class="lume-field__trigger" :class="{ 'is-filled': modelValue }" @click="openPicker">
      <span>{{ displayValue }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" class="lume-field__icon">
        <path
          d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 9H4v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7ZM5 6a1 1 0 0 0-1 1v2h16V7a1 1 0 0 0-1-1H5Z"
          fill="currentColor"
        />
      </svg>
    </button>

    <transition name="lume-popover">
      <div v-if="isOpen" class="lume-panel">
        <div class="lume-panel__header">
          <h3 class="lume-panel__title">
            {{ step === "year" ? "选择年份" : step === "month" ? `${selectedYear} 年` : `${monthLabel} ${selectedYear}` }}
          </h3>
          <div class="lume-panel__crumbs">
            <button
              type="button"
              class="lume-panel__crumb"
              :class="{ 'is-active': step === 'year' }"
              @click="step = 'year'"
            >
              Year
            </button>
            <button
              type="button"
              class="lume-panel__crumb"
              :class="{ 'is-active': step === 'month' }"
              :disabled="step === 'year'"
              @click="step = 'month'"
            >
              Month
            </button>
          </div>
        </div>

        <transition name="lume-stage" mode="out-in">
          <div v-if="step === 'year'" key="year" class="lume-stage lume-stage--year">
            <div class="lume-year-grid">
              <button
                v-for="year in yearRange"
                :key="year"
                type="button"
                class="lume-pill"
                :class="{ 'is-active': year === selectedYear }"
                @click="selectYear(year)"
              >
                {{ year }}
              </button>
            </div>
          </div>

          <div v-else-if="step === 'month'" key="month" class="lume-stage lume-stage--month">
            <div class="lume-month-grid">
              <button
                v-for="month in months"
                :key="month.value"
                type="button"
                class="lume-month-pill"
                :class="{ 'is-active': month.value === selectedMonth }"
                @click="selectMonth(month.value)"
              >
                <span class="lume-month-pill__name">{{ month.short }}</span>
                <span class="lume-month-pill__year">{{ month.year }}</span>
              </button>
            </div>
          </div>

          <div v-else key="day" class="lume-stage lume-stage--day">
            <div class="lume-weekdays">
              <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
            </div>
            <div class="lume-day-grid">
              <button
                v-for="cell in dayCells"
                :key="cell.key"
                type="button"
                class="lume-day-cell"
                :class="{
                  'is-muted': !cell.inMonth,
                  'is-today': cell.isToday,
                  'is-selected': cell.isSelected
                }"
                @click="selectDate(cell.date)"
              >
                {{ cell.label }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.lume-field {
  position: relative;
  display: grid;
  gap: 6px;
}

.lume-field__trigger {
  width: 100%;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: oklch(99.5% 0.003 224 / 0.96);
  padding: 10px 12px;
  color: #b4b4b4;
  font: inherit;
  text-align: left;
  transition:
    border-color var(--motion-swift) var(--ease-out-quad),
    box-shadow var(--motion-swift) var(--ease-out-quad),
    background-color var(--motion-swift) var(--ease-out-quad),
    color var(--motion-swift) var(--ease-out-quad);
}

.lume-field__trigger:hover,
.lume-field__trigger:focus-visible,
.lume-field__trigger.is-filled {
  color: var(--text);
}

.lume-field__trigger:focus-visible {
  border-color: oklch(86% 0.03 230);
  box-shadow: 0 0 0 4px oklch(94% 0.02 230 / 0.55);
  outline: none;
}

.lume-field__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  color: rgb(0 0 0 / 0.35);
}

.lume-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 24;
  width: 380px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid oklch(90% 0.01 228 / 0.9);
  background: oklch(99.4% 0.004 228 / 0.92);
  backdrop-filter: blur(18px);
  box-shadow:
    0 16px 44px oklch(28% 0.018 240 / 0.12),
    inset 0 1px 0 oklch(100% 0 0 / 0.7);
}

.lume-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.lume-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.lume-panel__crumbs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.lume-panel__crumb {
  min-height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid oklch(90% 0.01 228);
  background: oklch(99.8% 0.002 228 / 0.92);
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 600;
  transition: all var(--motion-swift) var(--ease-out-quad);
}

.lume-panel__crumb:disabled {
  opacity: 0.45;
  pointer-events: none;
}

.lume-panel__crumb.is-active {
  background: linear-gradient(180deg, oklch(95.8% 0.012 228 / 0.96), oklch(93.8% 0.014 228 / 0.92));
  border-color: oklch(85% 0.016 228);
  color: rgb(0 0 0 / 0.68);
  box-shadow: 0 6px 14px oklch(28% 0.016 240 / 0.05);
}

.lume-stage {
  min-height: 320px;
}

.lume-stage--year {
  max-height: 320px;
  overflow-y: auto;
  padding-right: 6px;
}

.lume-year-grid,
.lume-month-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.lume-pill,
.lume-month-pill {
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid oklch(90% 0.01 228);
  background: oklch(99.6% 0.002 228 / 0.95);
  color: var(--text-soft);
  transition: all var(--motion-swift) var(--ease-out-quad);
}

.lume-month-pill {
  min-height: 54px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.lume-pill:hover,
.lume-month-pill:hover,
.lume-day-cell:hover {
  border-color: oklch(84% 0.02 228);
  color: var(--text);
}

.lume-pill.is-active,
.lume-month-pill.is-active {
  background: linear-gradient(180deg, oklch(96.4% 0.012 228 / 0.98), oklch(94.8% 0.014 228 / 0.94));
  border-color: oklch(85% 0.016 228);
  color: rgb(0 0 0 / 0.68);
  box-shadow: 0 8px 18px rgb(0 0 0 / 0.06);
}

.lume-month-pill__name {
  font-size: 13px;
  font-weight: 650;
}

.lume-month-pill__year {
  font-size: 11px;
  color: inherit;
  opacity: 0.72;
}

.lume-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-bottom: 10px;
  color: var(--text-soft);
  font-size: 12px;
  text-align: center;
}

.lume-day-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.lume-day-cell {
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  transition: all var(--motion-swift) var(--ease-out-quad);
}

.lume-day-cell.is-muted {
  color: rgb(0 0 0 / 0.24);
}

.lume-day-cell.is-today {
  border-color: oklch(90% 0.01 228);
  background: oklch(98.8% 0.004 228 / 0.88);
}

.lume-day-cell.is-selected {
  border-color: transparent;
  background: linear-gradient(135deg, oklch(72% 0.23 2), oklch(79% 0.18 55));
  color: white;
  box-shadow: 0 12px 22px oklch(72% 0.18 28 / 0.18);
}

.lume-popover-enter-active,
.lume-popover-leave-active,
.lume-stage-enter-active,
.lume-stage-leave-active {
  transition:
    opacity var(--motion-swift) var(--ease-out-quad),
    transform var(--motion-swift) var(--ease-out-quad);
}

.lume-popover-enter-from,
.lume-popover-leave-to,
.lume-stage-enter-from,
.lume-stage-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
