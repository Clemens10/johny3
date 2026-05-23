<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSimulatorStore, type TraceEntry } from '@/stores/simulator'
import { formatDecimal } from '@/simulator/format'

const store = useSimulatorStore()
const collapsed = ref(false)

const VISIBLE_COUNT = 20

/** Letzte VISIBLE_COUNT Einträge, jüngster zuerst (T-0 oben). */
const entries = computed(() => {
  const all = store.trace
  return all.slice(-VISIBLE_COUNT).reverse()
})

// ─── Register-Diff zwischen before/after ─────────────────────────────────────
// Wir vergleichen alle sechs Register; nur geänderte landen im Diff-Text.

interface FieldDef {
  key: keyof TraceEntry['before']
  label: string
  fmt: (v: number) => string
}

const pad3 = (n: number) => String(n).padStart(3, '0')

const FIELDS: FieldDef[] = [
  { key: 'pc',         label: 'PC',  fmt: pad3 },
  { key: 'ir',         label: 'IR',  fmt: formatDecimal },
  { key: 'acc',        label: 'ACC', fmt: formatDecimal },
  { key: 'mc',         label: 'MC',  fmt: pad3 },
  { key: 'dataBus',    label: 'DB',  fmt: formatDecimal },
  { key: 'addressBus', label: 'AB',  fmt: pad3 },
]

function diffText(entry: TraceEntry): string {
  const parts: string[] = []
  for (const f of FIELDS) {
    const a = entry.before[f.key]
    const b = entry.after[f.key]
    if (a !== b) parts.push(`${f.label}: ${f.fmt(a)} → ${f.fmt(b)}`)
  }
  return parts.length === 0 ? '(keine Änderung)' : parts.join('   ')
}
</script>

<template>
  <!-- Eingeklappt: schmale vertikale Leiste ─────────────────────────────────── -->
  <div
    v-if="collapsed"
    class="h-full w-9 shrink-0 border-l border-gray-700 bg-gray-800 flex flex-col items-center cursor-pointer hover:bg-gray-700 select-none"
    title="Mikrocode-Trace einblenden"
    @click="collapsed = false"
  >
    <div class="rotate-180 mt-2 text-gray-400 hover:text-gray-100 text-xs px-1">◂</div>
    <div class="rotate-180 mt-2 text-gray-300 text-xs tracking-wider" style="writing-mode: vertical-rl">
      MIKROCODE-TRACE
    </div>
  </div>

  <!-- Ausgeklappt: vollständiges Panel ───────────────────────────────────────── -->
  <aside
    v-else
    class="h-full w-72 shrink-0 border-l border-gray-700 bg-gray-850 flex flex-col"
    style="background-color: rgb(20, 23, 32)"
  >
    <!-- Kopfzeile mit Titel + Einklapp-Button + Clear -->
    <div class="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
      <span class="text-xs font-semibold text-gray-200 tracking-wide">MIKROCODE-TRACE</span>
      <div class="flex items-center gap-2">
        <button
          class="text-xs text-gray-400 hover:text-gray-100 px-1"
          title="Trace leeren"
          @click="store.clearTrace"
        >
          ⌫
        </button>
        <button
          class="text-xs text-gray-400 hover:text-gray-100 px-1"
          title="Panel einklappen"
          @click="collapsed = true"
        >
          ▸
        </button>
      </div>
    </div>

    <!-- Trace-Liste -->
    <div class="flex-1 overflow-y-auto text-xs font-mono">
      <div
        v-if="entries.length === 0"
        class="text-gray-600 italic px-3 py-2"
      >
        Noch keine Mikroschritte ausgeführt.
      </div>

      <div
        v-for="(entry, index) in entries"
        :key="entry.id"
        :class="[
          'px-2 py-1 border-b border-gray-800 flex gap-2',
          index === 0 ? 'bg-blue-900/40' : '',
        ]"
      >
        <span class="text-gray-500 w-10 shrink-0">[T-{{ index }}]</span>
        <span class="text-yellow-300 w-20 shrink-0 truncate" :title="entry.signalName">{{ entry.signalName }}</span>
        <span class="text-gray-200 flex-1">{{ diffText(entry) }}</span>
      </div>
    </div>

    <!-- Fußzeile mit Zähler -->
    <div class="px-3 py-1 text-xs text-gray-500 border-t border-gray-700 shrink-0">
      {{ entries.length }} / {{ store.trace.length }} Einträge — jüngster oben
    </div>
  </aside>
</template>
