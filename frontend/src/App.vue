<script setup>
import { computed, ref, watch } from "vue";
import MembershipsView from "./views/MembershipsView.vue";
import WorkDailyView from "./views/WorkDailyView.vue";

const NAV_STORAGE_KEY = "work-daily-page-v1";
const currentPage = ref(localStorage.getItem(NAV_STORAGE_KEY) || "tasks");

const pageOptions = [
  { value: "tasks", label: "工作记录" },
  { value: "memberships", label: "会员到期" }
];

watch(currentPage, (value) => {
  localStorage.setItem(NAV_STORAGE_KEY, value);
});

const activeComponent = computed(() =>
  currentPage.value === "memberships" ? MembershipsView : WorkDailyView
);
</script>

<template>
  <div class="page-viewport">
    <div class="page-canvas app-page">
      <header class="top-nav-shell" aria-label="页面切换">
        <div class="top-nav-control">
          <button
            v-for="item in pageOptions"
            :key="item.value"
            type="button"
            class="top-nav-chip"
            :class="{ 'is-active': currentPage === item.value }"
            @click="currentPage = item.value"
          >
            {{ item.label }}
          </button>
        </div>
      </header>

      <main class="app-stage">
        <component :is="activeComponent" />
      </main>
    </div>
  </div>
</template>
