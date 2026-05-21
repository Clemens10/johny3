<script setup lang="ts">
import { useSimulatorStore } from '@/stores/simulator'
import { formatDecimal } from '@/simulator/format'
import ModeBadge from './ModeBadge.vue'

const store = useSimulatorStore()

/** Datei-Operationen werden nach oben gemeldet (implementiert in HomeView). */
const emit = defineEmits<{
  (e: 'file-new'):  void
  (e: 'file-open'): void
  (e: 'file-save'): void
}>()
</script>

<template>
  <header class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm shrink-0 flex-wrap">

    <!-- Logo -->
    <span class="font-bold text-blue-400 mr-1 text-base select-none">Johnny 3</span>

    <span class="text-gray-600 mx-0.5">│</span>

    <!-- Datei-Gruppe -->
    <button class="tbtn" title="Neues Programm (Strg+N)" @click="emit('file-new')">
      Neu
    </button>
    <button class="tbtn" title="Speichern (Strg+S)" @click="emit('file-save')">
      Speichern
    </button>
    <button class="tbtn" title="Öffnen (Strg+O)" @click="emit('file-open')">
      Öffnen
    </button>

    <span class="text-gray-600 mx-0.5">│</span>

    <!-- Simulations-Gruppe -->
    <button
      class="tbtn font-semibold"
      :class="store.isRunning
        ? 'bg-yellow-800 hover:bg-yellow-700 text-yellow-200'
        : 'bg-green-800  hover:bg-green-700  text-green-200'"
      :disabled="store.isHalted && !store.isRunning"
      title="Run / Pause (F5)"
      @click="store.toggleRun()"
    >
      {{ store.isRunning ? '⏸ Pause' : '▶ Run' }}
      <kbd>F5</kbd>
    </button>

    <button
      class="tbtn"
      :disabled="store.isRunning"
      title="Befehlsschritt (F10)"
      @click="store.step()"
    >
      Step <kbd>F10</kbd>
    </button>

    <button
      class="tbtn"
      :disabled="store.isRunning"
      title="Mikroschritt (F11)"
      @click="store.microstep()"
    >
      µStep <kbd>F11</kbd>
    </button>

    <button
      class="tbtn"
      title="Zurücksetzen (Shift+F5)"
      @click="store.reset()"
    >
      Reset <kbd>⇧F5</kbd>
    </button>

    <!-- Speed-Slider -->
    <div class="flex items-center gap-1 text-xs text-gray-400 ml-0.5">
      <span>Slow</span>
      <input
        type="range" min="1" max="10" step="1"
        class="w-20 accent-blue-400 cursor-pointer"
        :value="store.speed"
        @input="store.speed = +($event.target as HTMLInputElement).value"
        title="Geschwindigkeit"
      />
      <span>Fast</span>
    </div>

    <span class="text-gray-600 mx-0.5">│</span>

    <!-- Modus-Badge (Section 5.7) -->
    <ModeBadge />

    <!-- Status-Anzeige + Register (rechts) -->
    <div class="ml-auto flex items-center gap-3 text-xs font-mono">
      <span v-if="store.isRunning"
        class="text-green-400 animate-pulse">● läuft</span>
      <span v-else-if="store.isHalted"
        class="text-red-400">■ HLT</span>

      <span class="text-gray-600">│</span>

      <span title="Program Counter">
        PC: <span class="text-blue-300  font-bold">{{ String(store.pc).padStart(3,'0') }}</span>
      </span>
      <span title="Instruction Register">
        IR: <span class="text-purple-300 font-bold">{{ formatDecimal(store.ir) }}</span>
      </span>
      <span title="Accumulator">
        ACC: <span class="text-yellow-300 font-bold">{{ store.acc }}</span>
      </span>
      <span title="Microcode Counter">
        MC: <span class="text-gray-300  font-bold">{{ String(store.mc).padStart(3,'0') }}</span>
      </span>
    </div>

  </header>
</template>

<style scoped>
@reference "../assets/main.css";

.tbtn {
  @apply px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600
         disabled:opacity-40 disabled:cursor-not-allowed
         transition-colors text-gray-200;
}
kbd {
  @apply text-gray-400 text-xs ml-0.5 not-italic;
}
</style>
