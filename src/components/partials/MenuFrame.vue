<template>
    <v-container class="grey darken-3">
      <v-card class="white elevation-5">
        <v-card-text class="d-flex justify-center align-start" style="background-color: #F5F5F5; height: 100%;">
          <slot></slot>
        </v-card-text>
      </v-card>
    </v-container>
  </template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({

})
</script>

<style scoped>
  .grey {
    background-color: #424242;
    min-width: 100%;
    min-height: 100%;
    height: 100%;
  }
</style>