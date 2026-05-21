<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// ─── Monaco Worker-Konfiguration ──────────────────────────────────────────
// Muss einmalig gesetzt werden, bevor der Editor instanziiert wird.
// Für johnny3 brauchen wir nur den Editor-Worker (kein TS/JSON/HTML-Worker).
;(globalThis as any).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

// ─── Johnny-3-Assembler-Sprache registrieren ───────────────────────────────
const LANG_ID = 'johnny3'

function ensureLanguageRegistered() {
  if (monaco.languages.getLanguages().some(l => l.id === LANG_ID)) return

  monaco.languages.register({ id: LANG_ID, extensions: ['.johnny', '.asm'] })

  // Monarch-Tokenizer: Semicolon-Kommentare, Labels, Mnemonics, Zahlen
  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    keywords: [
      'TAKE', 'ADD', 'SUB', 'SAVE', 'JMP', 'TST', 'INC', 'DEC', 'NULL', 'HLT',
      'MUL', 'LOOP', 'TGT',  // Advanced
    ],
    tokenizer: {
      root: [
        [/;.*$/,                  'comment'],                         // ; Kommentar
        [/[a-zA-Z_]\w*(?=\s*:)/, 'type.identifier'],                 // label:
        [/[A-Z]{2,5}/,            { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/\d+/,                   'number'],
        [/[a-z_]\w*/,             'variable'],                        // Label-Referenzen
        [/[\t ]+/,                'white'],
      ],
    },
  })

  // Farb-Theme passend zum App-Design (gray-900 Hintergrund)
  monaco.editor.defineTheme('johnny3-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',         foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword',         foreground: '569cd6', fontStyle: 'bold'   },
      { token: 'type.identifier', foreground: 'dcdcaa'                      }, // Labels: gelb
      { token: 'number',          foreground: 'b5cea8'                      }, // Adressen: grün
      { token: 'variable',        foreground: '9cdcfe'                      }, // Label-Refs: hellblau
    ],
    colors: {
      'editor.background':             '#111827', // Tailwind gray-900
      'editor.lineHighlightBackground': '#1f2937', // gray-800
      'editorLineNumber.foreground':   '#4b5563', // gray-600
      'editorCursor.foreground':       '#60a5fa', // blue-400
      'editor.selectionBackground':    '#1e40af80',
    },
  })
}

// ─── Props & Emits ────────────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'change', source: string): void
  (e: 'save'):  void
  (e: 'new'):   void
  (e: 'open'):  void
}>()

// ─── Refs ─────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
  if (!containerRef.value) return
  ensureLanguageRegistered()

  editor = monaco.editor.create(containerRef.value, {
    value: '',               // Leer starten (kein Default-Programm)
    language: LANG_ID,
    theme: 'johnny3-dark',
    fontSize: 14,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,   // Reagiert auf Container-Resize
    tabSize: 8,
    insertSpaces: false,
    wordWrap: 'off',
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    smoothScrolling: true,
  })

  // ─── Tastaturkürzel: Browser-Defaults überschreiben ────────────────────
  // Monaco fängt diese innerhalb des Editors ab, damit kein Browser-Dialog
  // erscheint. Das globale useKeyboardShortcuts() greift außerhalb des Editors.
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    () => emit('save'),
  )
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN,
    () => emit('new'),
  )
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO,
    () => emit('open'),
  )

  // Content-Änderungen nach oben melden
  editor.onDidChangeModelContent(() => {
    emit('change', editor?.getValue() ?? '')
  })
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})

// ─── Öffentliche API (für HomeView via defineExpose) ──────────────────────
function setContent(text: string) {
  if (!editor) return
  editor.setValue(text)
  editor.setScrollPosition({ scrollTop: 0 })
}

function getContent(): string {
  return editor?.getValue() ?? ''
}

function focus() {
  editor?.focus()
}

defineExpose({ setContent, getContent, focus })
</script>

<template>
  <!-- Monaco füllt den Container über automaticLayout — kein explizites height/width nötig -->
  <div ref="containerRef" class="w-full h-full" />
</template>
