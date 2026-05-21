<script setup lang="ts">
import { ref } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import RamTable from '@/components/RamTable.vue'
import BusVisualization from '@/components/BusVisualization.vue'
import { formatDecimal } from '@/simulator/format'

const store = useSimulatorStore()

// Unterer Bereich: welcher Tab ist aktiv?
const bottomTab = ref<'ram' | 'microcode'>('ram')
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">

    <!-- ═══ TOOLBAR ═══ (Schritt 11 wird sie vollständig ersetzen) -->
    <header class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm shrink-0">
      <span class="font-bold text-blue-400 mr-2 text-base">Johny 3</span>

      <!-- Simulations-Steuerung -->
      <button
        class="px-3 py-1 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40 font-mono"
        :class="store.isRunning ? 'bg-yellow-700 hover:bg-yellow-600' : ''"
        :disabled="store.isHalted && !store.isRunning"
        @click="store.toggleRun()"
      >
        {{ store.isRunning ? '⏸ Pause' : '▶ Run' }}
      </button>
      <button
        class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40"
        :disabled="store.isRunning"
        title="F10"
        @click="store.step()"
      >
        Step
      </button>
      <button
        class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40"
        :disabled="store.isRunning"
        title="F11"
        @click="store.microstep()"
      >
        µStep
      </button>
      <button
        class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500"
        title="Shift+F5"
        @click="store.reset()"
      >
        Reset
      </button>

      <!-- Speed-Slider -->
      <div class="flex items-center gap-1 ml-2 text-xs text-gray-400">
        <span>Slow</span>
        <input
          type="range" min="1" max="10" step="1"
          class="w-20 accent-blue-400"
          :value="store.speed"
          @input="store.speed = +($event.target as HTMLInputElement).value"
        />
        <span>Fast</span>
      </div>

      <!-- Status-Badge -->
      <span v-if="store.isRunning"  class="text-green-400 ml-1 text-xs animate-pulse">● läuft</span>
      <span v-if="store.isHalted"   class="text-red-400 ml-1 text-xs">■ angehalten</span>

      <!-- Register-Anzeige (rechts) -->
      <div class="ml-auto flex gap-3 text-xs font-mono">
        <span>PC: <span class="text-blue-300 font-bold">{{ String(store.pc).padStart(3,'0') }}</span></span>
        <span>IR: <span class="text-purple-300 font-bold">{{ formatDecimal(store.ir) }}</span></span>
        <span>ACC: <span class="text-yellow-300 font-bold">{{ store.acc }}</span></span>
        <span>MC: <span class="text-gray-300 font-bold">{{ String(store.mc).padStart(3,'0') }}</span></span>
      </div>
    </header>

    <!-- ═══ MITTLERER BEREICH: Editor links | Bus-Visualisierung rechts ═══ -->
    <div class="flex flex-1 min-h-0 border-b border-gray-700">

      <!-- Linke Hälfte: Assembler-Editor (Platzhalter bis Schritt 13) -->
      <div class="flex-1 flex flex-col border-r border-gray-700">
        <div class="px-3 py-1 text-xs text-gray-500 bg-gray-800 border-b border-gray-700">
          Assembler-Editor (folgt in Schritt 13 — Monaco)
        </div>
        <div class="flex-1 flex items-center justify-center text-gray-600 text-sm font-mono">
          ; Hier kommt der Monaco-Editor
        </div>
      </div>

      <!-- Rechte Hälfte: Bus-Visualisierung -->
      <div class="flex-1">
        <BusVisualization />
      </div>

    </div>

    <!-- ═══ UNTERER BEREICH: RAM-Tabelle / Mikrocode (Tabs) ═══ -->
    <div class="h-56 flex flex-col shrink-0">

      <!-- Tab-Leiste -->
      <div class="flex text-xs border-b border-gray-700 bg-gray-800 shrink-0">
        <button
          class="px-4 py-1.5 border-b-2 transition-colors"
          :class="bottomTab === 'ram'
            ? 'border-blue-400 text-blue-300'
            : 'border-transparent text-gray-500 hover:text-gray-300'"
          @click="bottomTab = 'ram'"
        >
          RAM-Speicher
        </button>
        <button
          class="px-4 py-1.5 border-b-2 transition-colors"
          :class="bottomTab === 'microcode'
            ? 'border-blue-400 text-blue-300'
            : 'border-transparent text-gray-500 hover:text-gray-300'"
          @click="bottomTab = 'microcode'"
        >
          Mikrocode (folgt in Schritt 18)
        </button>
      </div>

      <!-- Tab-Inhalt -->
      <div class="flex-1 overflow-hidden">
        <RamTable v-if="bottomTab === 'ram'" />
        <div v-else class="flex items-center justify-center h-full text-gray-600 text-sm">
          Mikrocode-Tabelle kommt in Sprint 3
        </div>
      </div>

    </div>

  </div>
</template>
