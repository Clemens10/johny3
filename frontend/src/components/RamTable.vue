<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { formatDecimal, disassemble, decode } from '@/simulator/format'

const store = useSimulatorStore()

/**
 * Zeigt nur Adressen mit Inhalt ≠ 0 plus die aktuelle PC-Adresse
 * und eine konfigurierbare Anzahl an Zeilen drumherum.
 *
 * Für die erste Version zeigen wir immer die ersten 20 Zeilen
 * plus den Bereich rund um PC — kompakt und ohne virtuelles Scrolling.
 */
const CONTEXT_ROWS = 3   // Zeilen vor/nach PC immer sichtbar
const ALWAYS_SHOW = 20   // Erste N Zeilen immer anzeigen

const visibleRows = computed(() => {
  const ram = store.state.ram
  const pc = store.state.pc
  const rows: number[] = []

  // Zeilen die wir immer zeigen
  for (let i = 0; i < Math.min(ALWAYS_SHOW, ram.length); i++) {
    rows.push(i)
  }

  // Kontext rund um PC
  const from = Math.max(0, pc - CONTEXT_ROWS)
  const to   = Math.min(ram.length - 1, pc + CONTEXT_ROWS)
  for (let i = from; i <= to; i++) {
    if (!rows.includes(i)) rows.push(i)
  }

  // Nicht-leere Zellen außerhalb der ersten 20
  for (let i = ALWAYS_SHOW; i < ram.length; i++) {
    if (ram[i] !== 0 && !rows.includes(i)) rows.push(i)
  }

  return rows.sort((a, b) => a - b)
})

// Für die Inline-Bearbeitung einer Zelle
const editingAddress = ref<number | null>(null)
const editValue = ref('')

function startEdit(address: number) {
  editingAddress.value = address
  editValue.value = String(store.state.ram[address])
}

function commitEdit() {
  if (editingAddress.value === null) return
  const raw = parseInt(editValue.value.replace('.', ''), 10)
  if (!isNaN(raw)) {
    // Wert im OO.OOO-Format: opcode = floor/1000, operand = mod 1000
    const opcode  = Math.floor(raw / 1000)
    const operand = raw % 1000
    store.setRamCell(editingAddress.value, (opcode << 12) | operand)
  }
  editingAddress.value = null
}

function cancelEdit() {
  editingAddress.value = null
}
</script>

<template>
  <div class="overflow-auto h-full">
    <table class="w-full text-sm font-mono border-collapse">
      <thead class="sticky top-0 bg-gray-800 text-gray-200 z-10">
        <tr>
          <th class="px-3 py-1 text-right w-16">Adr</th>
          <th class="px-3 py-1 text-right w-20">Data</th>
          <th class="px-3 py-1 text-left  w-24">Asm</th>
          <th class="px-3 py-1 text-right w-14">Opnd</th>
          <th class="px-3 py-1 text-left">Note</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="addr in visibleRows" :key="addr">
          <!-- Trennlinie wenn Lücke zur vorherigen Zeile -->
          <tr
            v-if="addr > 0 && !visibleRows.includes(addr - 1)"
            class="text-gray-500"
          >
            <td colspan="5" class="px-3 py-0 text-center text-xs">⋮</td>
          </tr>

          <tr
            :class="[
              'border-b border-gray-700 hover:bg-gray-700 cursor-pointer',
              store.state.pc === addr ? 'bg-blue-900 text-blue-100' : 'text-gray-200',
            ]"
            @dblclick="startEdit(addr)"
          >
            <!-- Adresse -->
            <td class="px-3 py-0.5 text-right text-gray-400">
              {{ String(addr).padStart(3, '0') }}
            </td>

            <!-- Data im OO.OOO-Format (bei Doppelklick: Eingabefeld) -->
            <td class="px-3 py-0.5 text-right">
              <input
                v-if="editingAddress === addr"
                v-model="editValue"
                class="w-20 bg-gray-900 text-yellow-300 text-right rounded px-1 outline-none"
                @keydown.enter="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
                autofocus
              />
              <span v-else>{{ formatDecimal(store.state.ram[addr] ?? 0) }}</span>
            </td>

            <!-- Disassemblierter Befehl -->
            <td class="px-3 py-0.5 text-left text-green-400">
              {{ disassemble(store.state.ram[addr] ?? 0) }}
            </td>

            <!-- Operand als Dezimalzahl -->
            <td class="px-3 py-0.5 text-right text-gray-400">
              {{ decode(store.state.ram[addr] ?? 0).operand }}
            </td>

            <!-- Note (noch leer — kommt mit .johnny-Format) -->
            <td class="px-3 py-0.5 text-gray-500 text-xs italic">
              <span v-if="store.state.pc === addr">← PC</span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
