<script setup lang="ts">
import { GreeterMessage, formatGreeting } from "../features/greeter";

const message = formatGreeting("world");
</script>

<template>
  <main>
    <h1>{{ message }}</h1>
    <GreeterMessage name="world" />
  </main>
</template>
