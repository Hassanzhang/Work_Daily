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

const currentPageIndex = computed(() =>
  pages.findIndex((page) => page.value === currentPage.value)
);
</script>

<template>
  <div class="page-viewport">
    <div class="page-canvas">
      <header class="top-nav-shell">
        <AppTabs v-model="currentPage" :options="pages" />
      </header>
      <main class="app-stage">
        <div
          class="app-carousel"
          :style="{ transform: `translate3d(-${currentPageIndex * 50}%, 0, 0)` }"
        >
          <section class="app-page" :data-active="currentPage === 'tasks'">
            <WorkDailyView />
          </section>
          <section class="app-page" :data-active="currentPage === 'memberships'">
            <MembershipsView />
          </section>
        </div>
      </main>
    </div>
  </div>
</template>
