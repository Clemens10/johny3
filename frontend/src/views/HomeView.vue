<script setup lang="ts">
import { ref } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import Toolbar from '@/components/Toolbar.vue'
import RamTable from '@/components/RamTable.vue'
import BusVisualization from '@/components/BusVisualization.vue'

const store = useSimulatorStore()

// Tastaturkürzel registrieren (Schritt 12)
useKeyboardShortcuts({
  onNew:  () => { /* TODO Schritt 15: Datei-I/O */ console.log('Neu') },
  onSave: () => { console.log('Speichern') },
  onOpen: () => { console.log('Öffnen') },
})

const bottomTab = ref<'ram' | 'microcode'>('ram')
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">

    <!-- ═══ TOOLBAR (Schritt 11 + 12) ═══ -->
    <Toolbar
      @file-new="console.log('Neu')"
      @file-save="console.log('Speichern')"
      @file-open="console.log('Öffnen')"
    />

    <!-- ═══ MITTLERER BEREICH: Editor links | Bus-Visualisierung rechts ═══ -->
    <div class="flex flex-1 min-h-0 border-b border-gray-700">

      <!-- Linke Hälfte: Assembler-Editor (Platzhalter bis Schritt 13) -->
      <div class="flex-1 flex flex-col border-r border-gray-700">
        <div class="px-3 py-1 text-xs text-gray-500 bg-gray-800 border-b border-gray-700 select-none">
          Assembler-Editor — folgt in Schritt 13 (Monaco)
        </div>
        <div class="flex-1 flex items-center justify-center text-gray-700 text-sm font-mono italic">
          ; Hier kommt der Monaco-Editor
        </div>
      </div>

      <!-- Rechte Hälfte: Bus-Visualisierung (Schritt 10) -->
      <div class="flex-1 min-w-0">
        <BusVisualization />
      </div>

    </div>

    <!-- ═══ UNTERER BEREICH: RAM / Mikrocode (Tabs) ═══ -->
    <div class="h-56 flex flex-col shrink-0">

      <!-- Tab-Leiste -->
      <div class="flex text-xs border-b border-gray-700 bg-gray-800 shrink-0 select-none">
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
          Mikrocode (folgt in Sprint 3)
        </button>
      </div>

      <!-- Tab-Inhalt -->
      <div class="flex-1 overflow-hidden">
        <RamTable v-if="bottomTab === 'ram'" />
        <div v-else class="flex items-center justify-center h-full text-gray-700 text-sm">
          Mikrocode-Tabelle folgt in Sprint 3
        </div>
      </div>

    </div>

  </div>
</template>
