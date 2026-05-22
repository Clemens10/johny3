<script setup lang="ts">
import type { FileFormat } from '@/simulator/fileio'

defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', format: FileFormat): void
}>()

const FORMATS: { format: FileFormat; label: string; desc: string }[] = [
  { format: 'johnny', label: '.johnny', desc: 'Vollständiger Workspace — RAM, Mikrocode, Quelltext & Labels' },
  { format: 'ram',    label: '.ram',    desc: 'Nur RAM-Inhalt — kompatibel mit Original-Johny' },
  { format: 'mc',     label: '.mc',     desc: 'Nur Mikrocode — kompatibel mit Original-Johny' },
]
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="emit('close')"
  >
    <div class="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-[26rem] p-4">
      <h2 class="text-sm font-semibold text-gray-100 mb-3">Speichern unter — Format wählen</h2>

      <div class="flex flex-col gap-2">
        <button
          v-for="f in FORMATS"
          :key="f.format"
          class="text-left px-3 py-2 rounded border border-gray-600 hover:border-blue-400 hover:bg-gray-700 transition-colors"
          @click="emit('select', f.format)"
        >
          <div class="font-mono text-blue-300 text-sm">{{ f.label }}</div>
          <div class="text-xs text-gray-400 mt-0.5">{{ f.desc }}</div>
        </button>
      </div>

      <div class="flex justify-end mt-3">
        <button
          class="text-xs text-gray-400 hover:text-gray-200 px-3 py-1"
          @click="emit('close')"
        >
          Abbrechen
        </button>
      </div>
    </div>
  </div>
</template>
