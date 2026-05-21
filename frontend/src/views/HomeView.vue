<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useSimulatorStore } from '@/stores/simulator'
import { assemble } from '@/simulator/assembler'
import Toolbar from '@/components/Toolbar.vue'
import EditorPane from '@/components/EditorPane.vue'
import RamTable from '@/components/RamTable.vue'
import BusVisualization from '@/components/BusVisualization.vue'

const store = useSimulatorStore()
const editorRef = ref<InstanceType<typeof EditorPane>>()
const bottomTab = ref<'ram' | 'microcode'>('ram')

// ─── Assembler: bei jeder Editor-Änderung (debounced 400 ms) ─────────────────
let assembleTimer: ReturnType<typeof setTimeout> | null = null

function handleEditorChange(src: string) {
  if (assembleTimer !== null) clearTimeout(assembleTimer)
  assembleTimer = setTimeout(() => {
    const result = assemble(src)
    editorRef.value?.setErrors(result.errors)
    if (result.errors.length === 0) {
      store.updateRam(result.ram)
    }
  }, 400)
}

// ─── Datei-Operationen (werden von Toolbar, Editor-Kürzel und globalem Handler geteilt) ──
// Implementierung folgt in Schritt 15 (Datei-I/O).
function handleNew() {
  // TODO Schritt 15: Bestätigungs-Dialog wenn Editor nicht leer
  editorRef.value?.setContent('')
}

function handleSave() {
  // TODO Schritt 15: .johnny-Datei herunterladen
  const src = editorRef.value?.getContent() ?? ''
  console.log('Speichern:', src.slice(0, 50) + '…')
}

function handleOpen() {
  // TODO Schritt 15: File-Picker öffnen
  console.log('Öffnen')
}

// ─── Globale Tastaturkürzel (F5/F10/F11 + Strg+N/S/O außerhalb Monaco) ──
useKeyboardShortcuts({ onNew: handleNew, onSave: handleSave, onOpen: handleOpen })
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">

    <!-- ═══ TOOLBAR ═══ -->
    <Toolbar
      @file-new="handleNew"
      @file-save="handleSave"
      @file-open="handleOpen"
    />

    <!-- ═══ MITTLERER BEREICH: Editor links | Bus rechts ═══ -->
    <div class="flex flex-1 min-h-0 border-b border-gray-700">

      <!-- Linke Hälfte: Assembler-Editor (Monaco) -->
      <div class="flex-1 flex flex-col border-r border-gray-700 min-w-0">
        <EditorPane
          ref="editorRef"
          class="flex-1 min-h-0"
          @save="handleSave"
          @new="handleNew"
          @open="handleOpen"
          @change="handleEditorChange"
        />
      </div>

      <!-- Rechte Hälfte: Bus-Visualisierung -->
      <div class="flex-1 min-w-0">
        <BusVisualization />
      </div>

    </div>

    <!-- ═══ UNTERER BEREICH: RAM / Mikrocode (Tabs) ═══ -->
    <div class="h-56 flex flex-col shrink-0">

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

      <div class="flex-1 overflow-hidden">
        <RamTable v-if="bottomTab === 'ram'" />
        <div v-else class="flex items-center justify-center h-full text-gray-700 text-sm">
          Mikrocode-Tabelle folgt in Sprint 3
        </div>
      </div>

    </div>

  </div>
</template>
