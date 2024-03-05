<template>
  <v-alert :type="type" :height="height" :elevation="elevation" :max-height="maxHeight" :closable="closable"
    v-model="show">
    {{ text }}
  </v-alert>
</template>
  
<script>
export default {
  data() {
    return {
      show: this.value,
    }
  },
  props: {
    type: {
      type: String,
      default: "info",
      validator: (value) => ["success", "info", "warning", "error"].includes(value),
    },
    text: {
      type: String,
      required: true,
    },
    height: {
      type: [Number, String],
      default: undefined,
    },
    elevation: {
      type: [Number, String],
      default: undefined,
    },
    maxHeight: {
      type: [Number, String],
      default: undefined,
    },
    closable: {
      type: [Boolean],
      default: true
    }
  },
  watch: {
    show(val) {
      this.$emit('input', val)
    }
  }
}
</script>