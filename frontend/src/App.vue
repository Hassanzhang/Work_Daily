<script setup>
import { computed, ref, watch } from "vue";
import AppTabs from "./components/AppTabs.vue";
import MembershipsView from "./views/MembershipsView.vue";
import WorkDailyView from "./views/WorkDailyView.vue";

const NAV_KEY = "work-daily-page-v1";
const currentPage = ref(localStorage.getItem(NAV_KEY) || "tasks");

const pages = [
  { value: "tasks", label: "工作记录" },
  { value: "memberships", label: "会员管理" }
];

watch(currentPage, (v) => localStorage.setItem(NAV_KEY, v));

const activeView = computed(() =>
  currentPage.value === "memberships" ? MembershipsView : WorkDailyView
);
</script>

<template>
  <a href="#main-content" class="skip-link">跳到主内容</a>
  <div class="page-viewport">
    <div class="page-canvas">
      <header class="top-nav-shell">
        <AppTabs v-model="currentPage" :options="pages" />
      </header>
      <main id="main-content" class="app-stage">
        <component :is="activeView" />
      </main>
    </div>
  </div>
</template>
