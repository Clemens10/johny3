<script setup lang="ts">
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { formatDecimal, formatHex, formatWord } from '@/simulator/format'
import { Signal } from '@/simulator/types'
import BusSignalChip from './BusSignalChip.vue'

const store = useSimulatorStore()
const s = computed(() => store.state)

/** Welches Signal ist gerade aktiv (letzter ausgeführter Mikroschritt). */
const activeSignal = computed(() => {
  const mc = s.value.mc
  if (mc === 0) return null
  return s.value.microcode[mc - 1] ?? null
})

const abActive = computed(() =>
  activeSignal.value === Signal.PC_AB ||
  activeSignal.value === Signal.INS_AB,
)

const dbActive = computed(() =>
  activeSignal.value === Signal.RAM_DB ||
  activeSignal.value === Signal.DB_INS ||
  activeSignal.value === Signal.ACC_DB ||
  activeSignal.value === Signal.DB_ACC ||
  activeSignal.value === Signal.DB_RAM,
)

const ab = computed(() => s.value.addressBus)
const db = computed(() => s.value.dataBus)

/** Lesbare Signalnamen für den Tooltip ("Signal 13: plus"). */
const SIGNAL_NAMES: Record<number, string> = {
  0: 'nop', 1: 'db→ram', 2: 'ram→db', 3: 'db→ins', 4: 'ins→ab',
  5: 'ins→mc', 6: '=0?', 7: 'mc:=0', 8: 'pc→ab', 9: 'pc++',
  10: '=0:pc++', 11: 'ins→pc', 12: 'acc:=0', 13: 'plus', 14: 'minus',
  15: 'acc→db', 16: 'acc++', 17: 'acc--', 18: 'db→acc', 19: 'stop',
  20: 'mul', 21: 'pc--', 22: '>0:pc++',
  24: 'and', 25: 'or', 26: 'not', 27: 'shl', 28: 'shr',
}

function fullName(sig: Signal): string {
  return SIGNAL_NAMES[sig] ?? `sig${sig}`
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-900 text-gray-100 p-4 gap-2 font-mono text-sm select-none">

    <!-- ─── Bus-Legende ──────────────────────────────────────────────────── -->
    <div class="flex gap-4 text-xs">
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
        Adressbus (AB)
      </span>
      <span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
        Datenbus (DB)
      </span>
      <span v-if="store.isRecording" class="ml-auto text-yellow-300 text-xs font-semibold">
        ● Aufnahme — klicke ein Tor in der Visualisierung
      </span>
    </div>

    <!-- ─── Adressbus-Leiste (oben) ──────────────────────────────────────── -->
    <div
      class="flex items-center justify-center gap-2 rounded px-3 py-1 text-sm transition-all"
      :class="abActive ? 'bg-blue-800 text-blue-200' : 'bg-gray-800 text-gray-500'"
    >
      <span class="text-blue-400">AB</span>
      <span class="text-xs">→</span>
      <span class="text-white font-bold">{{ String(ab).padStart(3, '0') }}</span>
      <span class="text-xs text-gray-400">(Adresse)</span>
    </div>

    <!-- ─── Tore zur AB (zwischen AB und 3-Spalten-Block) ────────────────── -->
    <div class="grid grid-cols-3 gap-3 items-start">
      <!-- über MEMORY: nichts (AB wird von MEMORY nur gelesen) -->
      <div></div>
      <!-- über CONTROL UNIT: pc→ab und ins→ab -->
      <div class="flex justify-center gap-1.5">
        <BusSignalChip
          :signal="Signal.PC_AB"  label="↑ pc→ab"
          :full-name="fullName(Signal.PC_AB)"  :active-signal="activeSignal"
        />
        <BusSignalChip
          :signal="Signal.INS_AB" label="↑ ins→ab"
          :full-name="fullName(Signal.INS_AB)" :active-signal="activeSignal"
        />
      </div>
      <!-- über ALU: nichts -->
      <div></div>
    </div>

    <!-- ─── Drei Hauptspalten ────────────────────────────────────────────── -->
    <div class="grid grid-cols-3 gap-3 flex-1 min-h-0">

      <!-- MEMORY ────────────────────────────────────────────────────────── -->
      <div class="flex flex-col rounded border-2 transition-all"
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

      <!-- CONTROL UNIT ──────────────────────────────────────────────────── -->
      <div class="flex flex-col rounded border-2 border-gray-600 min-h-0">
        <div class="bg-gray-700 text-center py-1 text-xs font-bold tracking-widest rounded-t text-gray-300">
          CONTROL UNIT
        </div>
        <div class="flex-1 p-2 flex flex-col gap-2 overflow-auto">

          <!-- Register PC / IR / MC -->
          <div class="flex flex-col gap-0.5">
            <div class="flex justify-between items-center">
              <span class="text-gray-400 text-xs">PC</span>
              <span class="font-bold transition-colors"
                :class="activeSignal === Signal.PC_INC || activeSignal === Signal.PC_DEC || activeSignal === Signal.INS_PC
                  ? 'text-blue-300' : 'text-white'"
              >
                {{ String(s.pc).padStart(3, '0') }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-400 text-xs">IR</span>
              <span class="font-bold transition-colors"
                :class="activeSignal === Signal.DB_INS ? 'text-yellow-300' : 'text-white'"
              >
                {{ formatWord(s.ir, store.wordFormat) }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-400 text-xs">MC</span>
              <span class="font-bold text-purple-300">{{ String(s.mc).padStart(3, '0') }}</span>
            </div>
          </div>

          <!-- Operationen: PC-Modifikationen -->
          <div class="border-t border-gray-700 pt-1.5">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">PC-Operationen</div>
            <div class="flex flex-wrap gap-1">
              <BusSignalChip :signal="Signal.PC_INC"    label="pc++"     :full-name="fullName(Signal.PC_INC)"    :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.PC_DEC"    label="pc--"     :full-name="fullName(Signal.PC_DEC)"    :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ZERO_SKIP" label="=0:pc++"  :full-name="fullName(Signal.ZERO_SKIP)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.GT_SKIP"   label=">0:pc++"  :full-name="fullName(Signal.GT_SKIP)"   :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.INS_PC"    label="ins→pc"   :full-name="fullName(Signal.INS_PC)"    :active-signal="activeSignal" />
            </div>
          </div>

          <!-- Operationen: MC / Decode / Steuerung -->
          <div class="border-t border-gray-700 pt-1.5">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Steuerung</div>
            <div class="flex flex-wrap gap-1">
              <BusSignalChip :signal="Signal.INS_MC"    label="ins→mc"   :full-name="fullName(Signal.INS_MC)"    :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.MC_ZERO"   label="mc:=0"    :full-name="fullName(Signal.MC_ZERO)"   :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ZERO_TEST" label="=0?"      :full-name="fullName(Signal.ZERO_TEST)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.STOP"      label="stop"     :full-name="fullName(Signal.STOP)"      :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.NOP"       label="nop"      :full-name="fullName(Signal.NOP)"       :active-signal="activeSignal" />
            </div>
          </div>

          <!-- Nächstes Signal (Statusanzeige, kein Chip) -->
          <div class="mt-auto pt-1.5 border-t border-gray-700">
            <div class="text-[10px] text-gray-500 mb-0.5">Nächstes Signal:</div>
            <div class="text-yellow-400 text-xs font-bold">
              {{ s.microcode[s.mc] !== undefined
                ? `[${s.mc}] ${fullName((s.microcode[s.mc] ?? 0) as Signal)}`
                : '—' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ALU ───────────────────────────────────────────────────────────── -->
      <div class="flex flex-col rounded border-2 transition-all min-h-0"
        :class="activeSignal === Signal.PLUS || activeSignal === Signal.MINUS || activeSignal === Signal.MUL
          ? 'border-yellow-500' : 'border-gray-600'"
      >
        <div class="bg-gray-700 text-center py-1 text-xs font-bold tracking-widest rounded-t text-gray-300">
          ALU
        </div>
        <div class="flex-1 p-2 flex flex-col gap-2 overflow-auto">

          <!-- ACC-Wert -->
          <div class="flex flex-col items-center gap-1 pb-1">
            <span class="text-gray-400 text-xs">ACC</span>
            <span
              class="text-2xl font-bold transition-colors"
              :class="activeSignal === Signal.PLUS || activeSignal === Signal.MINUS || activeSignal === Signal.MUL || activeSignal === Signal.ACC_ZERO
                ? 'text-yellow-300' : 'text-white'"
            >
              {{ formatWord(s.acc, store.wordFormat) }}
            </span>
            <span class="text-gray-500 text-xs">{{ formatHex(s.acc) }}</span>
            <div v-if="s.halted" class="mt-1 text-red-400 text-xs font-bold animate-pulse">
              ■ HLT
            </div>
          </div>

          <!-- Arithmetik (Tore am ALU-Eingang) -->
          <div class="border-t border-gray-700 pt-1.5">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Arithmetik</div>
            <div class="flex flex-wrap gap-1">
              <BusSignalChip :signal="Signal.PLUS"  label="+"      :full-name="fullName(Signal.PLUS)"  :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.MINUS" label="−"      :full-name="fullName(Signal.MINUS)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.MUL"   label="×"      :full-name="fullName(Signal.MUL)"   :active-signal="activeSignal" />
            </div>
          </div>

          <!-- Bitweise (Advanced) -->
          <div
            v-if="s.activeFeatures.has('F4_BITWISE')"
            class="border-t border-gray-700 pt-1.5"
          >
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Bitweise</div>
            <div class="flex flex-wrap gap-1">
              <BusSignalChip :signal="Signal.AND" label="AND" :full-name="fullName(Signal.AND)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.OR"  label="OR"  :full-name="fullName(Signal.OR)"  :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.NOT" label="NOT" :full-name="fullName(Signal.NOT)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.SHL" label="<<1" :full-name="fullName(Signal.SHL)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.SHR" label=">>1" :full-name="fullName(Signal.SHR)" :active-signal="activeSignal" />
            </div>
          </div>

          <!-- ACC-Operationen -->
          <div class="border-t border-gray-700 pt-1.5">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">ACC-Operationen</div>
            <div class="flex flex-wrap gap-1">
              <BusSignalChip :signal="Signal.ACC_ZERO" label="acc:=0" :full-name="fullName(Signal.ACC_ZERO)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ACC_INC"  label="acc++"  :full-name="fullName(Signal.ACC_INC)"  :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ACC_DEC"  label="acc--"  :full-name="fullName(Signal.ACC_DEC)"  :active-signal="activeSignal" />
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ─── Tore zur DB (zwischen 3-Spalten-Block und DB) ────────────────── -->
    <div class="grid grid-cols-3 gap-3 items-start">
      <!-- unter MEMORY: ram↔db -->
      <div class="flex justify-center gap-1.5">
        <BusSignalChip :signal="Signal.RAM_DB" label="↓ ram→db" :full-name="fullName(Signal.RAM_DB)" :active-signal="activeSignal" />
        <BusSignalChip :signal="Signal.DB_RAM" label="↑ db→ram" :full-name="fullName(Signal.DB_RAM)" :active-signal="activeSignal" />
      </div>
      <!-- unter CU: db→ins -->
      <div class="flex justify-center">
        <BusSignalChip :signal="Signal.DB_INS" label="↑ db→ins" :full-name="fullName(Signal.DB_INS)" :active-signal="activeSignal" />
      </div>
      <!-- unter ALU: acc↔db -->
      <div class="flex justify-center gap-1.5">
        <BusSignalChip :signal="Signal.ACC_DB" label="↓ acc→db" :full-name="fullName(Signal.ACC_DB)" :active-signal="activeSignal" />
        <BusSignalChip :signal="Signal.DB_ACC" label="↑ db→acc" :full-name="fullName(Signal.DB_ACC)" :active-signal="activeSignal" />
      </div>
    </div>

    <!-- ─── Datenbus-Leiste (unten) ──────────────────────────────────────── -->
    <div
      class="flex items-center justify-center gap-2 rounded px-3 py-1 text-sm transition-all"
      :class="dbActive ? 'bg-green-800 text-green-200' : 'bg-gray-800 text-gray-500'"
    >
      <span class="text-green-400">DB</span>
      <span class="text-xs">↔</span>
      <span class="text-white font-bold">{{ formatWord(db, store.wordFormat) }}</span>
      <span class="text-xs text-gray-400">({{ formatDecimal(db) }} / {{ formatHex(db) }})</span>
    </div>

  </div>
</template>
