<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(["update:modelValue"]);

function selectTab(value) {
  if (value === props.modelValue) return;
  emit("update:modelValue", value);
}
</script>

<template>
  <nav class="app-tabs" aria-label="页面切换">
    <div class="app-tabs__list" role="tablist" aria-orientation="horizontal">
      <button
        v-for="item in options"
        :key="item.value"
        type="button"
        role="tab"
        class="app-tabs__trigger"
        :class="{ 'is-active': modelValue === item.value }"
        :aria-selected="modelValue === item.value"
        @click="selectTab(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </nav>
</template>
