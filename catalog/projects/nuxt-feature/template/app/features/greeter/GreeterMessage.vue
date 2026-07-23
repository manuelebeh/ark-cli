<script setup lang="ts">
defineProps<{
  name?: string;
}>();
</script>

<template>
  <p>Hello, {{ name ?? "world" }}</p>
</template>
