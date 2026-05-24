<script setup lang="ts">
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { type Signal } from '@/simulator/types'
import { isSignalAvailable } from '@/simulator/signals'

/**
 * Klickbares "Tor" in der Bus-Visualisierung. Im Recorder-Modus wird der
 * Klick als aufgenommenes Signal an den Store gemeldet; sonst dient die
 * Komponente nur der Visualisierung (kein Hover-Effekt, kein Klick).
 *
 * Wird `signal` durch das aktuelle Feature-Set ausgeschlossen (z. B. mul
 * im Classic-Modus), rendert die Komponente NICHTS — die Bus-Karte zeigt
 * also nur tatsächlich verfügbare Tore.
 */
const props = defineProps<{
  signal: Signal
  /** Sichtbarer Text auf dem Chip, z. B. "pc→ab" oder "+". */
  label: string
  /** Voller Signalname für den Tooltip. */
  fullName: string
  /** Aktuell ausgeführtes Signal (vom Parent durchgereicht). */
  activeSignal: Signal | null
}>()

const store = useSimulatorStore()

const available = computed(() => isSignalAvailable(props.signal, store.state.activeFeatures))
const isActive  = computed(() => props.activeSignal === props.signal)

function click() {
  if (store.isRecording) store.recordSignal(props.signal)
}
</script>

<template>
  <button
    v-if="available"
    type="button"
    class="px-1.5 py-0.5 rounded border text-xs font-mono whitespace-nowrap transition-colors"
    :class="{
      'border-yellow-400 bg-yellow-900 text-yellow-100 ring-1 ring-yellow-400 shadow-yellow-500/40 shadow':
        isActive,
      'border-gray-600 bg-gray-800 text-yellow-300 hover:bg-yellow-800 hover:border-yellow-500 hover:text-yellow-100 cursor-pointer':
        store.isRecording && !isActive,
      'border-gray-800 bg-gray-900/60 text-gray-500 cursor-default':
        !store.isRecording && !isActive,
    }"
    :title="`Signal ${signal}: ${fullName}`"
    @click="click"
  >
    {{ label }}
  </button>
</template>
