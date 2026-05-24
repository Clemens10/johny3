<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { signalName, formatByte } from '@/simulator/format'
import { Signal, MICROCODE_SIZE, type Signal as SignalType } from '@/simulator/types'
import { isSignalAvailable } from '@/simulator/signals'

const store = useSimulatorStore()

const ALL_ADDRESSES = Array.from({ length: MICROCODE_SIZE }, (_, i) => i)

/**
 * Alle Signal-Codes für das Bearbeitungs-Dropdown.
 * Reihenfolge entspricht der Signal-Tabelle in types.ts.
 */
const ALL_SIGNALS = Object.values(Signal).filter(
  (v): v is SignalType => typeof v === 'number',
).sort((a, b) => a - b)

/**
 * Signal-Liste für ein bestimmtes Dropdown. Filtert Advanced-Signale anhand
 * der aktiven Features (Classic → nur 0–19). Der aktuelle Zellwert wird auch
 * dann eingeblendet, wenn er an sich nicht verfügbar ist — sonst würde das
 * Dropdown nach einem Modus-Wechsel den eigenen Wert verlieren.
 */
function optionsFor(addr: number): SignalType[] {
  const visible = ALL_SIGNALS.filter(s => isSignalAvailable(s, store.state.activeFeatures))
  const current = (store.state.microcode[addr] ?? 0) as SignalType
  if (visible.includes(current)) return visible
  return [...visible, current].sort((a, b) => a - b)
}

/**
 * Einsprung-Labels für die Mnemonic-Spalte. Nur an den Default-Einsprung­
 * adressen befüllt; freie Slots wie 110/120/130 bleiben leer und können vom
 * User für eigene Befehle benutzt werden.
 */
const INSTRUCTION_LABELS: Record<number, string> = {
  0:   'FETCH',
  10:  'TAKE',
  20:  'ADD',
  30:  'SUB',
  40:  'SAVE',
  50:  'JMP',
  60:  'TST',
  70:  'INC',
  80:  'DEC',
  90:  'NULL',
  100: 'HLT',
}

// ─── Scrollen ─────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement>()

function scrollToAddress(addr: number, behavior: ScrollBehavior = 'smooth') {
  const row = containerRef.value?.querySelector<HTMLElement>(`[data-mc="${addr}"]`)
  row?.scrollIntoView({ block: 'center', behavior })
}

// Auto-Scroll wenn der MC-Zeiger sich bewegt
watch(() => store.state.mc, async (mc) => {
  await nextTick()
  scrollToAddress(mc)
})

onMounted(async () => {
  await nextTick()
  scrollToAddress(store.state.mc, 'instant')
})

// ─── Jump-to-address ──────────────────────────────────────────────────────────
const jumpInput = ref('')

function handleJump() {
  const addr = parseInt(jumpInput.value, 10)
  if (!isNaN(addr) && addr >= 0 && addr < MICROCODE_SIZE) {
    scrollToAddress(addr, 'smooth')
  }
}

// ─── Inline-Bearbeitung (Dropdown) ────────────────────────────────────────────
const editingAddress = ref<number | null>(null)

function startEdit(address: number) {
  editingAddress.value = address
}

function commitEdit(address: number, event: Event) {
  const value = parseInt((event.target as HTMLSelectElement).value, 10)
  if (!isNaN(value)) {
    store.setMicrocodeCell(address, value as SignalType)
  }
  editingAddress.value = null
}

function cancelEdit() {
  editingAddress.value = null
}

// ─── Sichtbares Highlight für Einsprung-Zeilen ────────────────────────────────
function isEntryRow(addr: number): boolean {
  return INSTRUCTION_LABELS[addr] !== undefined
}

// Hervorhebung für die gerade aktive Recorder-Einsprungadresse
const recorderEntry = computed(() => store.recordingEntry)
</script>

<template>
  <div class="flex flex-col h-full">

    <!-- ─── Jump-to-address Bar ─── -->
    <div class="flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700 shrink-0 text-xs">
      <span class="text-gray-400">Springe zu:</span>
      <input
        v-model="jumpInput"
        type="number"
        min="0"
        max="199"
        placeholder="0–199"
        class="w-20 bg-gray-900 text-gray-100 rounded px-1.5 py-0.5 outline-none border border-gray-600 focus:border-blue-400"
        @keydown.enter="handleJump"
      />
      <button
        class="px-2 py-0.5 rounded border border-gray-600 text-blue-400 hover:text-blue-200 hover:border-blue-400 transition-colors"
        @click="handleJump"
      >
        Go
      </button>
      <span class="ml-auto text-gray-500">
        MC: <span class="text-purple-300 font-mono">{{ String(store.state.mc).padStart(3, '0') }}</span>
        <span v-if="store.isRecording" class="ml-3 text-yellow-300">
          Recorder-Einsprung: <span class="font-mono">{{ String(recorderEntry).padStart(3, '0') }}</span>
        </span>
      </span>
    </div>

    <!-- ─── Tabelle (alle 200 Slots) ─── -->
    <div ref="containerRef" class="overflow-y-auto flex-1">
      <table class="w-full text-sm font-mono border-collapse">
        <thead class="sticky top-0 bg-gray-800 text-gray-200 z-10">
          <tr>
            <th class="px-3 py-1 text-right w-16">Mikr.</th>
            <th
              class="px-3 py-1 text-right"
              :class="store.wordFormat === 'bin' ? 'w-24' : 'w-14'"
            >Code</th>
            <th class="px-3 py-1 text-left  w-32">Signal</th>
            <th class="px-3 py-1 text-left">Befehl</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="addr in ALL_ADDRESSES"
            :key="addr"
            :data-mc="addr"
            :class="[
              'border-b border-gray-800',
              store.state.mc === addr ? 'bg-purple-900 text-purple-100' : 'text-gray-200',
              isEntryRow(addr) ? 'bg-opacity-100' : '',
              store.isRecording && addr === recorderEntry ? 'ring-1 ring-yellow-500 ring-inset' : '',
            ]"
          >
            <!-- Mikroadresse -->
            <td
              class="px-3 py-0.5 text-right"
              :class="isEntryRow(addr) ? 'text-blue-300 font-bold' : 'text-gray-500'"
            >
              {{ String(addr).padStart(3, '0') }}
            </td>

            <!-- Signal-Code (gemäß globalem Format-Toggle) -->
            <td class="px-3 py-0.5 text-right text-gray-400">
              {{ formatByte(store.state.microcode[addr] ?? 0, store.wordFormat) }}
            </td>

            <!-- Signal-Name + Dropdown -->
            <td
              class="px-3 py-0.5 text-yellow-300 cursor-pointer hover:bg-gray-700"
              @dblclick="startEdit(addr)"
            >
              <select
                v-if="editingAddress === addr"
                class="bg-gray-900 text-yellow-200 px-1 outline-none border border-blue-400 rounded text-xs"
                :value="store.state.microcode[addr]"
                @change="commitEdit(addr, $event)"
                @blur="cancelEdit"
                autofocus
              >
                <option v-for="sig in optionsFor(addr)" :key="sig" :value="sig">
                  {{ sig }} — {{ signalName(sig) }}
                </option>
              </select>
              <span v-else>{{ signalName(store.state.microcode[addr] ?? 0) }}</span>
            </td>

            <!-- Befehls-Mnemonic (nur an Einsprungadressen) -->
            <td
              class="px-3 py-0.5 text-left"
              :class="isEntryRow(addr) ? 'text-blue-300 font-semibold' : 'text-gray-700 italic'"
            >
              <template v-if="isEntryRow(addr)">{{ INSTRUCTION_LABELS[addr] }}:</template>
              <template v-else-if="store.isRecording && addr === recorderEntry">
                ← Recorder-Einsprung
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="px-3 py-1 text-xs text-gray-500 border-t border-gray-700 shrink-0 bg-gray-800">
      Doppelklick auf <span class="text-yellow-300">Signal</span> öffnet ein Dropdown.
    </div>

  </div>
</template>
