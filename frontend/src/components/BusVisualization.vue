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

// --- Flash-Highlights (Feature B) ---

/** Das zuletzt ausgeführte Signal (automatisch nach 400 ms gelöscht). */
const flash = computed(() => store.lastExecutedSignal)

/** Gibt 'source', 'target' oder null zurück — für CSS-Klassen. */
function flashClass(type: 'source' | 'target' | null): string {
  if (type === 'source') return 'flash-source'
  if (type === 'target') return 'flash-target'
  return ''
}

const pcFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.PC_AB) return 'source'
  if (f === Signal.PC_INC || f === Signal.PC_DEC || f === Signal.ZERO_SKIP ||
      f === Signal.GT_SKIP || f === Signal.INS_PC) return 'target'
  return null
})

const irFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.INS_AB || f === Signal.INS_MC || f === Signal.INS_PC) return 'source'
  if (f === Signal.DB_INS) return 'target'
  return null
})

const mcFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.MC_ZERO || f === Signal.INS_MC) return 'target'
  return null
})

const accFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.ACC_DB) return 'source'
  if (f === Signal.DB_ACC || f === Signal.PLUS || f === Signal.MINUS || f === Signal.MUL ||
      f === Signal.ACC_ZERO || f === Signal.ACC_INC || f === Signal.ACC_DEC ||
      f === Signal.AND || f === Signal.OR || f === Signal.NOT ||
      f === Signal.SHL || f === Signal.SHR) return 'target'
  return null
})

const abFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.PC_AB || f === Signal.INS_AB) return 'target'
  return null
})

const dbFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.DB_INS || f === Signal.DB_ACC || f === Signal.DB_RAM) return 'source'
  if (f === Signal.RAM_DB || f === Signal.ACC_DB) return 'target'
  return null
})

const ramFlashType = computed(() => {
  const f = flash.value
  if (f === Signal.RAM_DB) return 'source'
  if (f === Signal.DB_RAM) return 'target'
  return null
})

// --- Pfeil-Farben (Feature C) ---

const hov = computed(() => store.hoveredSignal)

function arrowColor(
  activeSignals: Signal[],
  hoverSignals: Signal[],
  activeColor: string,
  hoverColor = 'text-yellow-400/50',
): string {
  if (flash.value !== null && activeSignals.includes(flash.value)) return activeColor
  if (hov.value !== null && hoverSignals.includes(hov.value)) return hoverColor
  return 'text-gray-700'
}

// Top-Connector CU → AB: pc→ab und ins→ab fließen aufwärts
const arrowCuToAb = computed(() =>
  arrowColor([Signal.PC_AB, Signal.INS_AB], [Signal.PC_AB, Signal.INS_AB], 'text-yellow-400'))

// Bottom-Connector MEMORY ↕ DB
const arrowRamToDb = computed(() =>
  arrowColor([Signal.RAM_DB], [Signal.RAM_DB], 'text-yellow-400'))
const arrowDbToRam = computed(() =>
  arrowColor([Signal.DB_RAM], [Signal.DB_RAM], 'text-green-400', 'text-green-400/50'))

// Bottom-Connector CU: db→ins fließt aufwärts (DB → IR)
const arrowDbToIr = computed(() =>
  arrowColor([Signal.DB_INS], [Signal.DB_INS], 'text-green-400', 'text-green-400/50'))

// Bottom-Connector ALU ↕ DB
const arrowAccToDb = computed(() =>
  arrowColor([Signal.ACC_DB], [Signal.ACC_DB], 'text-yellow-400'))
const arrowDbToAcc = computed(() =>
  arrowColor([Signal.DB_ACC], [Signal.DB_ACC], 'text-green-400', 'text-green-400/50'))

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
  <div class="flex flex-col h-full bg-gray-900 text-gray-100 p-3 gap-2 font-mono text-sm select-none">

    <!-- ─── Bus-Legende ──────────────────────────────────────────────────── -->
    <div class="flex gap-3 text-xs items-center">
      <span class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
        AB
      </span>
      <span class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
        DB
      </span>
      <span v-if="store.isRecording" class="ml-auto text-yellow-300 text-xs font-semibold">
        ● Aufnahme — klicke ein Tor in der Bus-Linie oder eine Operation
      </span>
    </div>

    <!-- ─── Adressbus-Balken ───────────────────────────────────────────── -->
    <div
      class="rounded transition-colors shrink-0"
      :class="[
        abActive ? 'bg-blue-900/70 ring-1 ring-blue-500' : 'bg-gray-800',
        flashClass(abFlashType),
      ]"
    >
      <div class="flex items-center justify-center gap-2 px-3 pt-1 pb-0.5"
        :class="abActive ? 'text-blue-100' : 'text-gray-400'"
      >
        <span class="text-blue-400 text-xs font-bold">ADRESSBUS</span>
        <span class="text-xs">→</span>
        <span class="text-white font-bold">{{ String(ab).padStart(3, '0') }}</span>
        <span class="text-[10px] text-gray-500">(Adresse)</span>
      </div>
      <div class="grid grid-cols-3 gap-2 px-2 pb-1.5">
        <div></div>
        <div class="flex flex-wrap justify-center gap-1">
          <BusSignalChip
            :signal="Signal.PC_AB"  label="pc→ab"
            :full-name="fullName(Signal.PC_AB)"  :active-signal="activeSignal"
          />
          <BusSignalChip
            :signal="Signal.INS_AB" label="ins→ab"
            :full-name="fullName(Signal.INS_AB)" :active-signal="activeSignal"
          />
        </div>
        <div></div>
      </div>
    </div>

    <!-- ─── Pfeil-Connector AB → Grid ────────────────────────────────────── -->
    <div class="grid grid-cols-3 gap-2 shrink-0 h-3.5">
      <div></div>
      <!-- CU: PC/IR → AB aufwärts -->
      <div class="flex justify-center items-center" :class="arrowCuToAb" title="pc→ab / ins→ab">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" class="transition-colors duration-200">
          <line x1="4" y1="13" x2="4" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <polyline points="1,7 4,1 7,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
      <div></div>
    </div>

    <!-- ─── Drei Hauptspalten ─────────────────────────────────────────────── -->
    <div class="grid grid-cols-3 gap-2 flex-1 min-h-0">

      <!-- MEMORY ────────────────────────────────────────────────────────── -->
      <div class="flex flex-col rounded border-2 transition-colors min-h-0"
        :class="dbActive && activeSignal === Signal.RAM_DB ? 'border-green-500' : 'border-gray-600'"
      >
        <div class="bg-gray-700 text-center py-0.5 text-[11px] font-bold tracking-widest rounded-t text-gray-300">
          MEMORY
        </div>
        <div class="flex-1 flex flex-col items-center justify-center gap-1 p-2 overflow-hidden">
          <div class="text-gray-400 text-[10px]">RAM [ {{ String(ab).padStart(3, '0') }} ]</div>
          <div
            class="text-white text-base font-bold truncate w-full text-center rounded px-1"
            :class="flashClass(ramFlashType)"
          >
            {{ formatWord(s.ram[ab] ?? 0, store.wordFormat) }}
          </div>
          <div class="text-gray-500 text-[10px] truncate w-full text-center">{{ formatHex(s.ram[ab] ?? 0) }}</div>
        </div>
      </div>

      <!-- CONTROL UNIT ──────────────────────────────────────────────────── -->
      <div class="flex flex-col rounded border-2 border-gray-600 min-h-0">
        <div class="bg-gray-700 text-center py-0.5 text-[11px] font-bold tracking-widest rounded-t text-gray-300">
          CONTROL UNIT
        </div>
        <div class="flex-1 p-1.5 flex flex-col gap-1.5 overflow-auto">

          <!-- Register PC / IR / MC kompakt -->
          <div class="flex flex-col gap-0">
            <div class="flex justify-between items-baseline gap-2">
              <span class="text-gray-400 text-[10px]">PC</span>
              <span
                class="font-bold text-sm truncate rounded px-0.5"
                :class="[
                  flashClass(pcFlashType),
                  !pcFlashType && (activeSignal === Signal.PC_INC || activeSignal === Signal.PC_DEC || activeSignal === Signal.INS_PC)
                    ? 'text-blue-300' : 'text-white'
                ]"
              >
                {{ String(s.pc).padStart(3, '0') }}
              </span>
            </div>
            <div class="flex justify-between items-baseline gap-2">
              <span class="text-gray-400 text-[10px]">IR</span>
              <span
                class="font-bold text-sm truncate rounded px-0.5"
                :class="[
                  flashClass(irFlashType),
                  !irFlashType && activeSignal === Signal.DB_INS ? 'text-yellow-300' : 'text-white'
                ]"
              >
                {{ formatWord(s.ir, store.wordFormat) }}
              </span>
            </div>
            <div class="flex justify-between items-baseline gap-2">
              <span class="text-gray-400 text-[10px]">MC</span>
              <span
                class="font-bold text-sm truncate rounded px-0.5"
                :class="[flashClass(mcFlashType), 'text-purple-300']"
              >
                {{ String(s.mc).padStart(3, '0') }}
              </span>
            </div>
          </div>

          <!-- PC-Operationen -->
          <div class="border-t border-gray-700 pt-1">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">PC-Operationen</div>
            <div class="flex flex-wrap gap-0.5">
              <BusSignalChip :signal="Signal.PC_INC"    label="pc++"     :full-name="fullName(Signal.PC_INC)"    :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.PC_DEC"    label="pc--"     :full-name="fullName(Signal.PC_DEC)"    :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ZERO_SKIP" label="=0:pc++"  :full-name="fullName(Signal.ZERO_SKIP)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.GT_SKIP"   label=">0:pc++"  :full-name="fullName(Signal.GT_SKIP)"   :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.INS_PC"    label="ins→pc"   :full-name="fullName(Signal.INS_PC)"    :active-signal="activeSignal" />
            </div>
          </div>

          <!-- Steuerung (MC / Decode / Status) -->
          <div class="border-t border-gray-700 pt-1">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Steuerung</div>
            <div class="flex flex-wrap gap-0.5">
              <BusSignalChip :signal="Signal.INS_MC"    label="ins→mc"   :full-name="fullName(Signal.INS_MC)"    :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.MC_ZERO"   label="mc:=0"    :full-name="fullName(Signal.MC_ZERO)"   :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ZERO_TEST" label="=0?"      :full-name="fullName(Signal.ZERO_TEST)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.STOP"      label="stop"     :full-name="fullName(Signal.STOP)"      :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.NOP"       label="nop"      :full-name="fullName(Signal.NOP)"       :active-signal="activeSignal" />
            </div>
          </div>

          <!-- Nächstes Signal (Statusanzeige, kein Chip) -->
          <div class="mt-auto pt-1 border-t border-gray-700">
            <div class="text-[9px] text-gray-500">Nächstes Signal:</div>
            <div class="text-yellow-400 text-[11px] font-bold truncate">
              {{ s.microcode[s.mc] !== undefined
                ? `[${s.mc}] ${fullName((s.microcode[s.mc] ?? 0) as Signal)}`
                : '—' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ALU ───────────────────────────────────────────────────────────── -->
      <div class="flex flex-col rounded border-2 transition-colors min-h-0"
        :class="activeSignal === Signal.PLUS || activeSignal === Signal.MINUS || activeSignal === Signal.MUL
          ? 'border-yellow-500' : 'border-gray-600'"
      >
        <div class="bg-gray-700 text-center py-0.5 text-[11px] font-bold tracking-widest rounded-t text-gray-300">
          ALU
        </div>
        <div class="flex-1 p-1.5 flex flex-col gap-1.5 overflow-auto">

          <!-- ACC-Wert kompakt -->
          <div class="flex flex-col items-center gap-0 pb-0.5">
            <span class="text-gray-400 text-[10px]">ACC</span>
            <span
              class="text-lg font-bold truncate w-full text-center rounded px-1"
              :class="[
                flashClass(accFlashType),
                !accFlashType && (activeSignal === Signal.PLUS || activeSignal === Signal.MINUS || activeSignal === Signal.MUL || activeSignal === Signal.ACC_ZERO)
                  ? 'text-yellow-300' : 'text-white'
              ]"
            >
              {{ formatWord(s.acc, store.wordFormat) }}
            </span>
            <span class="text-gray-500 text-[10px] truncate w-full text-center">{{ formatHex(s.acc) }}</span>
            <div v-if="s.halted" class="mt-0.5 text-red-400 text-[10px] font-bold animate-pulse">
              ■ HLT
            </div>
          </div>

          <!-- Arithmetik -->
          <div class="border-t border-gray-700 pt-1">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Arithmetik</div>
            <div class="flex flex-wrap gap-0.5">
              <BusSignalChip :signal="Signal.PLUS"  label="+"  :full-name="fullName(Signal.PLUS)"  :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.MINUS" label="−"  :full-name="fullName(Signal.MINUS)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.MUL"   label="×"  :full-name="fullName(Signal.MUL)"   :active-signal="activeSignal" />
            </div>
          </div>

          <!-- Bitweise (Advanced) -->
          <div
            v-if="s.activeFeatures.has('F4_BITWISE')"
            class="border-t border-gray-700 pt-1"
          >
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Bitweise</div>
            <div class="flex flex-wrap gap-0.5">
              <BusSignalChip :signal="Signal.AND" label="AND" :full-name="fullName(Signal.AND)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.OR"  label="OR"  :full-name="fullName(Signal.OR)"  :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.NOT" label="NOT" :full-name="fullName(Signal.NOT)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.SHL" label="<<1" :full-name="fullName(Signal.SHL)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.SHR" label=">>1" :full-name="fullName(Signal.SHR)" :active-signal="activeSignal" />
            </div>
          </div>

          <!-- ACC-Operationen -->
          <div class="border-t border-gray-700 pt-1">
            <div class="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">ACC-Operationen</div>
            <div class="flex flex-wrap gap-0.5">
              <BusSignalChip :signal="Signal.ACC_ZERO" label="acc:=0" :full-name="fullName(Signal.ACC_ZERO)" :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ACC_INC"  label="acc++"  :full-name="fullName(Signal.ACC_INC)"  :active-signal="activeSignal" />
              <BusSignalChip :signal="Signal.ACC_DEC"  label="acc--"  :full-name="fullName(Signal.ACC_DEC)"  :active-signal="activeSignal" />
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ─── Pfeil-Connector Grid → DB ────────────────────────────────────── -->
    <div class="grid grid-cols-3 gap-2 shrink-0 h-3.5">
      <!-- MEMORY: ↓ ram→db, ↑ db→ram -->
      <div class="flex justify-center items-center gap-2">
        <span :class="arrowRamToDb" class="transition-colors duration-200" title="ram→db">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <line x1="4" y1="1" x2="4" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="1,7 4,13 7,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          </svg>
        </span>
        <span :class="arrowDbToRam" class="transition-colors duration-200" title="db→ram">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <line x1="4" y1="13" x2="4" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="1,7 4,1 7,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          </svg>
        </span>
      </div>
      <!-- CU: ↑ db→ins (DB → IR aufwärts) -->
      <div class="flex justify-center items-center" :class="arrowDbToIr" title="db→ins">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" class="transition-colors duration-200">
          <line x1="4" y1="13" x2="4" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <polyline points="1,7 4,1 7,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
      <!-- ALU: ↓ acc→db, ↑ db→acc -->
      <div class="flex justify-center items-center gap-2">
        <span :class="arrowAccToDb" class="transition-colors duration-200" title="acc→db">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <line x1="4" y1="1" x2="4" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="1,7 4,13 7,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          </svg>
        </span>
        <span :class="arrowDbToAcc" class="transition-colors duration-200" title="db→acc">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <line x1="4" y1="13" x2="4" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="1,7 4,1 7,7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          </svg>
        </span>
      </div>
    </div>

    <!-- ─── Datenbus-Balken ───────────────────────────────────────────────── -->
    <div
      class="rounded transition-colors shrink-0"
      :class="[
        dbActive ? 'bg-green-900/70 ring-1 ring-green-500' : 'bg-gray-800',
        flashClass(dbFlashType),
      ]"
    >
      <div class="grid grid-cols-3 gap-2 px-2 pt-1.5 pb-0.5">
        <div class="flex flex-wrap justify-center gap-1">
          <BusSignalChip :signal="Signal.RAM_DB" label="ram→db" :full-name="fullName(Signal.RAM_DB)" :active-signal="activeSignal" />
          <BusSignalChip :signal="Signal.DB_RAM" label="db→ram" :full-name="fullName(Signal.DB_RAM)" :active-signal="activeSignal" />
        </div>
        <div class="flex flex-wrap justify-center gap-1">
          <BusSignalChip :signal="Signal.DB_INS" label="db→ins" :full-name="fullName(Signal.DB_INS)" :active-signal="activeSignal" />
        </div>
        <div class="flex flex-wrap justify-center gap-1">
          <BusSignalChip :signal="Signal.ACC_DB" label="acc→db" :full-name="fullName(Signal.ACC_DB)" :active-signal="activeSignal" />
          <BusSignalChip :signal="Signal.DB_ACC" label="db→acc" :full-name="fullName(Signal.DB_ACC)" :active-signal="activeSignal" />
        </div>
      </div>
      <div class="flex items-center justify-center gap-2 px-3 pb-1 pt-0.5"
        :class="dbActive ? 'text-green-100' : 'text-gray-400'"
      >
        <span class="text-green-400 text-xs font-bold">DATENBUS</span>
        <span class="text-xs">↔</span>
        <span class="text-white font-bold">{{ formatWord(db, store.wordFormat) }}</span>
        <span class="text-[10px] text-gray-500">({{ formatDecimal(db) }} / {{ formatHex(db) }})</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
@keyframes flash-source {
  0%   { background-color: rgba(234, 179, 8, 0.45); box-shadow: 0 0 6px rgba(234, 179, 8, 0.3); }
  100% { background-color: transparent; box-shadow: none; }
}
@keyframes flash-target {
  0%   { background-color: rgba(34, 197, 94, 0.45); box-shadow: 0 0 6px rgba(34, 197, 94, 0.3); }
  100% { background-color: transparent; box-shadow: none; }
}
.flash-source {
  animation: flash-source 400ms ease-out forwards;
}
.flash-target {
  animation: flash-target 400ms ease-out forwards;
}
</style>
