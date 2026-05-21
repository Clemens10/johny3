<script setup lang="ts">
import { useSimulatorStore } from '@/stores/simulator'
import RamTable from '@/components/RamTable.vue'
import { formatDecimal } from '@/simulator/format'

const store = useSimulatorStore()
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-gray-100 select-none">

    <!-- Temporäre Mini-Toolbar (wird in Schritt 11 durch vollständige Toolbar ersetzt) -->
    <div class="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700 text-sm shrink-0">
      <span class="font-bold text-blue-400 mr-2">Johny 3</span>

      <button
        class="px-3 py-1 rounded bg-green-700 hover:bg-green-600 disabled:opacity-40"
        :disabled="store.isHalted || store.isRunning"
        @click="store.toggleRun()"
      >
        ▶ Run
      </button>
      <button
        class="px-3 py-1 rounded bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40"
        :disabled="store.isRunning"
        @click="store.step()"
      >
        Step F10
      </button>
      <button
        class="px-3 py-1 rounded bg-yellow-800 hover:bg-yellow-700 disabled:opacity-40"
        :disabled="store.isRunning"
        @click="store.microstep()"
      >
        µStep F11
      </button>
      <button
        class="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500"
        @click="store.reset()"
      >
        Reset
      </button>

      <span v-if="store.isRunning" class="text-green-400 ml-2 animate-pulse">● läuft</span>
      <span v-if="store.isHalted" class="text-red-400 ml-2">■ angehalten</span>

      <!-- Register-Anzeige -->
      <div class="ml-auto flex gap-4 text-xs font-mono">
        <span>PC: <span class="text-blue-300">{{ String(store.pc).padStart(3, '0') }}</span></span>
        <span>IR: <span class="text-purple-300">{{ formatDecimal(store.ir) }}</span></span>
        <span>ACC: <span class="text-yellow-300">{{ store.acc }}</span></span>
        <span>MC: <span class="text-gray-300">{{ String(store.mc).padStart(3, '0') }}</span></span>
      </div>
    </div>

    <!-- Hauptbereich: RAM-Tabelle (vorerst allein, später mit Editor + Bus geteilt) -->
    <div class="flex-1 overflow-hidden">
      <RamTable />
    </div>

  </div>
</template>
