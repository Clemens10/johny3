<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useSimulatorStore } from '@/stores/simulator'
import { assemble } from '@/simulator/assembler'
import {
  importRam, exportRam, importMc, exportMc,
  importJohnny, exportJohnny, detectFormat, type FileFormat,
} from '@/simulator/fileio'
import Toolbar from '@/components/Toolbar.vue'
import EditorPane from '@/components/EditorPane.vue'
import RamTable from '@/components/RamTable.vue'
import BusVisualization from '@/components/BusVisualization.vue'
import MicrocodeTracePanel from '@/components/MicrocodeTracePanel.vue'
import MicrocodeTable from '@/components/MicrocodeTable.vue'
import RecorderBanner from '@/components/RecorderBanner.vue'
import SaveDialog from '@/components/SaveDialog.vue'

const store = useSimulatorStore()
const editorRef = ref<InstanceType<typeof EditorPane>>()
const bottomTab = ref<'ram' | 'microcode'>('ram')

// Letzte Assembler-Labels — werden beim .johnny-Export mitgespeichert.
const lastLabels = ref<Record<string, number>>({})

// ─── Toast-Benachrichtigungen ────────────────────────────────────────────────
type ToastKind = 'info' | 'warn' | 'error'
const toasts = ref<{ id: number; text: string; kind: ToastKind }[]>([])
let toastId = 0

function notify(text: string, kind: ToastKind = 'info') {
  const id = toastId++
  toasts.value.push({ id, text, kind })
  setTimeout(() => dismissToast(id), 6000)
}
function dismissToast(id: number) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}
function reportWarnings(warnings: string[]) {
  warnings.slice(0, 4).forEach(w => notify(w, 'warn'))
  if (warnings.length > 4) {
    notify(`… und ${warnings.length - 4} weitere Warnungen`, 'warn')
  }
}

// ─── Assembler: bei jeder Editor-Änderung (debounced 400 ms) ─────────────────
let assembleTimer: ReturnType<typeof setTimeout> | null = null

function handleEditorChange(src: string) {
  if (assembleTimer !== null) clearTimeout(assembleTimer)
  assembleTimer = setTimeout(() => {
    const result = assemble(src)
    editorRef.value?.setErrors(result.errors)
    lastLabels.value = result.labels
    if (result.errors.length === 0) {
      store.updateRam(result.ram)
    }
  }, 400)
}

// ─── Neu ─────────────────────────────────────────────────────────────────────
function handleNew() {
  editorRef.value?.setContent('')
  store.loadRam([])
}

// ─── Speichern (Format-Dialog) ───────────────────────────────────────────────
const showSaveDialog = ref(false)
function handleSave() {
  showSaveDialog.value = true
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function handleSaveAs(format: FileFormat) {
  showSaveDialog.value = false
  const { ram, microcode, activeFeatures } = store.state

  if (format === 'ram') {
    downloadFile('programm.ram', exportRam(ram), 'text/plain')
    notify('Als programm.ram gespeichert', 'info')
  } else if (format === 'mc') {
    downloadFile('programm.mc', exportMc(microcode), 'text/plain')
    notify('Als programm.mc gespeichert', 'info')
  } else {
    const json = exportJohnny({
      ram,
      microcode,
      editorSource: editorRef.value?.getContent() ?? '',
      labels: lastLabels.value,
      mode: store.mode,
      advancedFeatures: [...activeFeatures],
    })
    downloadFile('programm.johnny', json, 'application/json')
    notify('Als programm.johnny gespeichert', 'info')
  }
}

// ─── Öffnen (Format an Dateiendung erkennen) ─────────────────────────────────
function handleOpen() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ram,.mc,.johnny'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const format = detectFormat(file.name)
    if (!format) {
      notify(`Unbekanntes Dateiformat: ${file.name}`, 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => openFileContent(format, String(reader.result ?? ''), file.name)
    reader.onerror = () => notify(`Datei konnte nicht gelesen werden: ${file.name}`, 'error')
    reader.readAsText(file)
  }
  input.click()
}

function openFileContent(format: FileFormat, text: string, filename: string) {
  try {
    if (format === 'ram') {
      const { ram, warnings } = importRam(text)
      store.loadRam(ram)
      reportWarnings(warnings)
    } else if (format === 'mc') {
      const { microcode, warnings } = importMc(text)
      store.loadMicrocode(microcode)
      reportWarnings(warnings)
    } else {
      const result = importJohnny(text)
      store.loadWorkspace({
        ram: result.ram,
        microcode: result.microcode,
        features: result.advancedFeatures,
      })
      // Quelltext nur setzen, wenn vorhanden — sonst würde das
      // Auto-Assemblieren den gerade geladenen RAM überschreiben.
      if (result.editorSource.trim() !== '') {
        editorRef.value?.setContent(result.editorSource)
      }
      reportWarnings(result.warnings)
    }
    notify(`${filename} geladen`, 'info')
  } catch (e) {
    notify(`Fehler beim Laden: ${(e as Error).message}`, 'error')
  }
}

// ─── Globale Tastaturkürzel (F5/F10/F11 + Strg+N/S/O außerhalb Monaco) ──
useKeyboardShortcuts({ onNew: handleNew, onSave: handleSave, onOpen: handleOpen })
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-gray-100 overflow-hidden">

    <!-- ═══ MIN-WIDTH-HINWEIS (nur unter 1280 px sichtbar) ═══ -->
    <div
      class="block xl:hidden bg-yellow-900/90 text-yellow-100 text-xs text-center px-3 py-1 shrink-0 border-b border-yellow-700"
    >
      ⚠ Bildschirm zu schmal — Johny 3 ist für mindestens 1280 px Breite gedacht.
      Unter 1024 px kann das Layout unleserlich werden.
    </div>

    <!-- ═══ TOOLBAR ═══ -->
    <Toolbar
      @file-new="handleNew"
      @file-save="handleSave"
      @file-open="handleOpen"
    />

    <!-- ═══ RECORDER-BANNER (nur im Aufnahme-Modus sichtbar) ═══ -->
    <RecorderBanner
      @warnings="reportWarnings"
      @saved="notify('Mikrocode-Sequenz gespeichert', 'info')"
    />

    <!-- ═══ DIALOGE & BENACHRICHTIGUNGEN ═══ -->
    <SaveDialog
      :open="showSaveDialog"
      @close="showSaveDialog = false"
      @select="handleSaveAs"
    />

    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="px-3 py-2 rounded shadow-lg text-sm cursor-pointer select-none"
        :class="{
          'bg-blue-900 text-blue-100 border border-blue-700':       t.kind === 'info',
          'bg-yellow-900 text-yellow-100 border border-yellow-700': t.kind === 'warn',
          'bg-red-900 text-red-100 border border-red-700':          t.kind === 'error',
        }"
        @click="dismissToast(t.id)"
      >
        {{ t.text }}
      </div>
    </div>

    <!-- ═══ MITTLERER BEREICH: Editor | Bus | (Trace) ═══ -->
    <!-- Flex-Anteil 2 — RAM/Mikrocode-Tabelle unten ist das Arbeitswerkzeug
         und bekommt den größeren Anteil 3. -->
    <div class="flex flex-[2_2_0] min-h-0 border-b border-gray-700">

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

      <!-- Mitte: Bus-Visualisierung -->
      <div class="flex-1 min-w-0">
        <BusVisualization />
      </div>

      <!-- Rechte Seitenleiste: Mikrocode-Trace (einklappbar) -->
      <MicrocodeTracePanel />

    </div>

    <!-- ═══ UNTERER BEREICH: RAM / Mikrocode (Tabs) — Hauptansicht ═══ -->
    <div class="flex-[3_3_0] flex flex-col min-h-0">

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
          Mikrocode
        </button>
      </div>

      <div class="flex-1 overflow-hidden">
        <RamTable v-if="bottomTab === 'ram'" />
        <MicrocodeTable v-else />
      </div>

    </div>

  </div>
</template>
