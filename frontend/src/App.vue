<script setup>
import { computed, ref, watch } from "vue";
import AppTabs from "./components/AppTabs.vue";
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
      <header class="top-nav-shell">
        <AppTabs v-model="currentPage" :options="pageOptions" />
      </header>

      <main class="app-stage">
        <component :is="activeComponent" />
      </main>
    </div>
  </div>
</template>
