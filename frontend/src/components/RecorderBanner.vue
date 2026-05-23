<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { signalName } from '@/simulator/format'
import { MICROCODE_SIZE } from '@/simulator/types'

/**
 * Recorder-Banner — sichtbar wenn `store.isRecording` true ist.
 * Zeigt Mnemonic- und Einsprung-Eingabe sowie die aktuell aufgenommene Sequenz
 * als klickbare Chips, plus Undo/Abbrechen/Speichern.
 */

const store = useSimulatorStore()
const emit = defineEmits<{
  (e: 'warnings', warnings: string[]): void
  (e: 'saved'): void
}>()

/** Warnungen aus dem letzten Commit-Versuch — wenn vorhanden, "Trotzdem speichern" zeigen. */
const pendingWarnings = ref<string[]>([])

const entryStr = computed({
  get: () => String(store.recordingEntry),
  set: (v: string) => {
    const n = parseInt(v, 10)
    if (!isNaN(n) && n >= 0 && n < MICROCODE_SIZE) store.recordingEntry = n
  },
})

function trySave() {
  const warnings = store.commitRecording(false)
  if (warnings.length === 0) {
    pendingWarnings.value = []
    emit('saved')
  } else {
    pendingWarnings.value = warnings
    emit('warnings', warnings)
  }
}

function saveAnyway() {
  const already = new Set(pendingWarnings.value)
  const warnings = store.commitRecording(true)
  pendingWarnings.value = []
  emit('saved')
  // Nur neue Warnungen toasten — die alten hat der User bereits gesehen.
  const fresh = warnings.filter(w => !already.has(w))
  if (fresh.length > 0) emit('warnings', fresh)
}

// Buffer-Änderung (neuer Schritt oder Undo) macht alte Warnungen obsolet.
watch(() => store.recordingSignals, () => {
  if (pendingWarnings.value.length > 0) pendingWarnings.value = []
})

function cancel() {
  pendingWarnings.value = []
  store.cancelRecording()
}
</script>

<template>
  <div
    v-if="store.isRecording"
    class="px-3 py-2 bg-red-950/60 border-b-2 border-red-800 text-sm shrink-0 flex flex-wrap items-center gap-3"
  >
    <!-- Status-Indikator -->
    <span class="text-red-300 font-semibold flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
      AUFNAHME
    </span>

    <!-- Mnemonic -->
    <label class="flex items-center gap-1 text-xs text-gray-300">
      Mnemonic
      <input
        v-model="store.recordingMnemonic"
        type="text"
        maxlength="8"
        placeholder="MYCMD"
        class="w-24 bg-gray-900 text-yellow-200 font-mono rounded px-1.5 py-0.5 outline-none border border-gray-600 focus:border-red-400"
      />
    </label>

    <!-- Einsprungadresse -->
    <label class="flex items-center gap-1 text-xs text-gray-300">
      Einsprung
      <input
        v-model="entryStr"
        type="number"
        min="0"
        :max="MICROCODE_SIZE - 1"
        class="w-16 bg-gray-900 text-yellow-200 font-mono rounded px-1.5 py-0.5 outline-none border border-gray-600 focus:border-red-400"
      />
    </label>

    <!-- Aufgenommene Signale als Chips -->
    <div class="flex items-center gap-1 flex-wrap min-w-0">
      <span class="text-xs text-gray-500 shrink-0">Sequenz:</span>
      <template v-if="store.recordingSignals.length === 0">
        <span class="text-xs text-gray-600 italic">(noch leer — Signal in der Bus-Palette anklicken)</span>
      </template>
      <span
        v-for="(sig, idx) in store.recordingSignals"
        :key="idx"
        class="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-yellow-300 text-xs font-mono"
      >
        {{ idx + 1 }}. {{ signalName(sig) }}
      </span>
    </div>

    <!-- Buttons (rechts) -->
    <div class="ml-auto flex items-center gap-1.5">
      <button
        class="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs disabled:opacity-40"
        :disabled="store.recordingSignals.length === 0"
        title="Letztes Signal zurücknehmen (Strg+Z)"
        @click="store.undoRecord()"
      >
        ↶ Undo <kbd class="text-gray-400 ml-0.5">⌃Z</kbd>
      </button>
      <button
        class="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs"
        @click="cancel"
      >
        Abbrechen
      </button>
      <button
        v-if="pendingWarnings.length === 0"
        class="px-3 py-0.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-semibold disabled:opacity-40"
        :disabled="store.recordingSignals.length === 0"
        @click="trySave"
      >
        ✓ Speichern
      </button>
      <button
        v-else
        class="px-3 py-0.5 rounded bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-semibold"
        :title="pendingWarnings.join(' | ')"
        @click="saveAnyway"
      >
        ⚠ Trotzdem speichern
      </button>
    </div>

    <!-- Warnungs-Zeile -->
    <div
      v-if="pendingWarnings.length > 0"
      class="basis-full text-xs text-yellow-300 mt-1"
    >
      <span v-for="(w, i) in pendingWarnings" :key="i">⚠ {{ w }}<br /></span>
    </div>
  </div>
</template>
