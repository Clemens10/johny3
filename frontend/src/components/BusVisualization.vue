<script setup lang="ts">
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { formatDecimal, formatHex, formatWord } from '@/simulator/format'
import { Signal } from '@/simulator/types'

const store = useSimulatorStore()
const s = computed(() => store.state)

/** Welches Signal ist gerade aktiv (letzter ausgeführter Mikroschritt). */
const activeSignal = computed(() => {
  // mc zeigt auf den NÄCHSTEN Slot — der zuletzt ausgeführte ist mc-1
  // (außer nach MC_ZERO/INS_MC, wo mc direkt gesetzt wurde)
  const mc = s.value.mc
  if (mc === 0) return null
  return s.value.microcode[mc - 1] ?? null
})

/** Ist der Adressbus gerade aktiv (Signal schreibt auf AB)? */
const abActive = computed(() =>
  activeSignal.value === Signal.PC_AB ||
  activeSignal.value === Signal.INS_AB
)

/** Ist der Datenbus gerade aktiv (Signal überträgt Daten)? */
const dbActive = computed(() =>
  activeSignal.value === Signal.RAM_DB ||
  activeSignal.value === Signal.DB_INS ||
  activeSignal.value === Signal.ACC_DB ||
  activeSignal.value === Signal.DB_ACC ||
  activeSignal.value === Signal.DB_RAM
)

const ab = computed(() => s.value.addressBus)
const db = computed(() => s.value.dataBus)

/** Lesbare Signalnamen für die Anzeige. */
const SIGNAL_NAMES: Record<number, string> = {
  0: 'NOP', 1: 'db→ram', 2: 'ram→db', 3: 'db→ins', 4: 'ins→ab',
  5: 'ins→mc', 6: '=0?', 7: 'mc:=0', 8: 'pc→ab', 9: 'pc++',
  10: '=0:pc++', 11: 'ins→pc', 12: 'acc:=0', 13: 'plus', 14: 'minus',
  15: 'acc→db', 16: 'acc++', 17: 'acc--', 18: 'db→acc', 19: 'stop',
  20: 'mul', 21: 'pc--', 22: '>0:pc++', 23: '≤0:pc++',
  24: 'and', 25: 'or', 26: 'not', 27: 'shl', 28: 'shr',
}

function signalName(code: number | null): string {
  if (code === null) return '—'
  return SIGNAL_NAMES[code] ?? `sig${code}`
}

/**
 * Gruppierte Signal-Palette für den Recorder. Reihenfolge spiegelt grob
 * Section 3.4 der INSTRUCTIONS wider (Transfer / ALU / Steuerung / Advanced).
 */
const SIGNAL_GROUPS: { title: string; signals: Signal[] }[] = [
  { title: 'Transfer', signals: [
    Signal.PC_AB, Signal.INS_AB, Signal.RAM_DB, Signal.DB_INS,
    Signal.DB_RAM, Signal.ACC_DB, Signal.DB_ACC, Signal.INS_PC, Signal.INS_MC,
  ]},
  { title: 'ALU',      signals: [
    Signal.PLUS, Signal.MINUS, Signal.ACC_ZERO, Signal.ACC_INC, Signal.ACC_DEC,
  ]},
  { title: 'Steuern',  signals: [
    Signal.PC_INC, Signal.MC_ZERO, Signal.ZERO_TEST, Signal.ZERO_SKIP, Signal.STOP, Signal.NOP,
  ]},
  { title: 'Advanced', signals: [
    Signal.MUL, Signal.PC_DEC, Signal.GT_SKIP, Signal.LEQ_SKIP,
    Signal.AND, Signal.OR, Signal.NOT, Signal.SHL, Signal.SHR,
  ]},
]
</script>

<template>
  <div class="flex flex-col h-full bg-gray-900 text-gray-100 p-4 gap-3 font-mono text-sm select-none">

    <!-- Bus-Legende -->
    <div class="flex gap-4 text-xs mb-1">
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
        Adressbus (AB)
      </span>
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
        Datenbus (DB)
      </span>
    </div>

    <!-- Adressbus (oben) -->
    <div
      class="flex items-center justify-center gap-2 rounded px-3 py-1 text-sm transition-all"
      :class="abActive ? 'bg-blue-800 text-blue-200' : 'bg-gray-800 text-gray-500'"
    >
      <span class="text-blue-400">AB</span>
      <span class="text-xs">→</span>
      <span class="text-white font-bold">{{ String(ab).padStart(3, '0') }}</span>
      <span class="text-xs text-gray-400">(Adresse)</span>
    </div>

    <!-- Drei Hauptspalten -->
    <div class="flex gap-3 flex-1 min-h-0">

      <!-- MEMORY -->
      <div class="flex-1 flex flex-col rounded border-2 transition-all"
        :class="dbActive && activeSignal === Signal.RAM_DB ? 'border-green-500' : 'border-gray-600'"
      >
        <div class="bg-gray-700 text-center py-1 text-xs font-bold tracking-widest rounded-t text-gray-300">
          MEMORY
        </div>
        <div class="flex-1 flex flex-col items-center justify-center gap-2 p-3">
          <div class="text-gray-400 text-xs">RAM [ {{ String(ab).padStart(3, '0') }} ]</div>
          <div class="text-white text-lg font-bold">
            {{ formatWord(s.ram[ab] ?? 0, store.wordFormat) }}
          </div>
          <div class="text-gray-500 text-xs">{{ formatHex(s.ram[ab] ?? 0) }}</div>
        </div>
      </div>

      <!-- CONTROL UNIT -->
      <div class="flex-1 flex flex-col rounded border-2 border-gray-600">
        <div class="bg-gray-700 text-center py-1 text-xs font-bold tracking-widest rounded-t text-gray-300">
          CONTROL UNIT
        </div>
        <div class="flex-1 p-3 flex flex-col gap-2">

          <!-- PC -->
          <div class="flex justify-between items-center">
            <span class="text-gray-400 text-xs">PC</span>
            <span
              class="font-bold transition-colors"
              :class="activeSignal === Signal.PC_INC || activeSignal === Signal.INS_PC ? 'text-blue-300' : 'text-white'"
            >
              {{ String(s.pc).padStart(3, '0') }}
            </span>
          </div>

          <!-- IR -->
          <div class="flex justify-between items-center">
            <span class="text-gray-400 text-xs">IR</span>
            <span
              class="font-bold transition-colors"
              :class="activeSignal === Signal.DB_INS ? 'text-yellow-300' : 'text-white'"
            >
              {{ formatWord(s.ir, store.wordFormat) }}
            </span>
          </div>

          <!-- MC -->
          <div class="flex justify-between items-center">
            <span class="text-gray-400 text-xs">MC</span>
            <span class="font-bold text-purple-300">{{ String(s.mc).padStart(3, '0') }}</span>
          </div>

          <!-- Aktuelles Mikrosignal -->
          <div class="mt-auto pt-2 border-t border-gray-700">
            <div class="text-xs text-gray-500 mb-1">Nächstes Signal:</div>
            <div class="text-yellow-400 text-xs font-bold">
              {{ s.microcode[s.mc] !== undefined
                ? `[${s.mc}] ${signalName(s.microcode[s.mc] ?? null)}`
                : '—' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ALU -->
      <div class="flex-1 flex flex-col rounded border-2 transition-all"
        :class="activeSignal === Signal.PLUS || activeSignal === Signal.MINUS || activeSignal === Signal.MUL
          ? 'border-yellow-500' : 'border-gray-600'"
      >
        <div class="bg-gray-700 text-center py-1 text-xs font-bold tracking-widest rounded-t text-gray-300">
          ALU
        </div>
        <div class="flex-1 flex flex-col items-center justify-center gap-2 p-3">
          <span class="text-gray-400 text-xs">ACC</span>
          <span
            class="text-2xl font-bold transition-colors"
            :class="activeSignal === Signal.PLUS || activeSignal === Signal.MINUS || activeSignal === Signal.ACC_ZERO
              ? 'text-yellow-300' : 'text-white'"
          >
            {{ formatWord(s.acc, store.wordFormat) }}
          </span>
          <span class="text-gray-500 text-xs">{{ formatHex(s.acc) }}</span>

          <!-- Halted-Indikator -->
          <div v-if="s.halted" class="mt-2 text-red-400 text-xs font-bold animate-pulse">
            ■ HLT
          </div>
        </div>
      </div>

    </div>

    <!-- Datenbus (unten) -->
    <div
      class="flex items-center justify-center gap-2 rounded px-3 py-1 text-sm transition-all"
      :class="dbActive ? 'bg-green-800 text-green-200' : 'bg-gray-800 text-gray-500'"
    >
      <span class="text-green-400">DB</span>
      <span class="text-xs">↔</span>
      <span class="text-white font-bold">{{ formatWord(db, store.wordFormat) }}</span>
      <span class="text-xs text-gray-400">({{ formatDecimal(db) }} / {{ formatHex(db) }})</span>
    </div>

    <!-- ─── Signal-Palette (nur im Recorder-Modus klickbar) ───────────────── -->
    <div
      v-if="store.isRecording"
      class="rounded border border-yellow-700 bg-yellow-950/40 p-2 mt-1"
    >
      <div class="text-xs text-yellow-300 mb-1 font-semibold">
        ● Aufnahme — klicke ein Signal, um es aufzunehmen:
      </div>
      <div
        v-for="group in SIGNAL_GROUPS"
        :key="group.title"
        class="flex items-baseline gap-2 mb-1 last:mb-0"
      >
        <span class="text-gray-500 text-xs w-16 shrink-0">{{ group.title }}</span>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="sig in group.signals"
            :key="sig"
            class="px-1.5 py-0.5 rounded bg-gray-800 text-yellow-300 text-xs border border-gray-600
                   hover:bg-yellow-800 hover:text-yellow-100 hover:border-yellow-500 transition-colors"
            :title="`Code ${sig} — ${signalName(sig)}`"
            @click="store.recordSignal(sig)"
          >
            {{ signalName(sig) }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
