<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { formatDecimal, disassemble, decode } from '@/simulator/format'
import { RAM_SIZE } from '@/simulator/types'

const store = useSimulatorStore()

// Alle 1000 Adressen als statisches Array (0–999)
const ALL_ADDRESSES = Array.from({ length: RAM_SIZE }, (_, i) => i)

// ─── Scrollen ─────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLDivElement>()

function scrollToAddress(addr: number, behavior: ScrollBehavior = 'smooth') {
  const row = containerRef.value?.querySelector<HTMLElement>(`[data-addr="${addr}"]`)
  row?.scrollIntoView({ block: 'center', behavior })
}

// Auto-Scroll wenn PC sich ändert (nur wenn PC gerade nicht sichtbar)
watch(() => store.state.pc, async (pc) => {
  await nextTick()
  scrollToAddress(pc)
})

onMounted(async () => {
  await nextTick()
  scrollToAddress(store.state.pc, 'instant')
})

// ─── Jump-to-address ──────────────────────────────────────────────────────────
const jumpInput = ref('')

function handleJump() {
  const addr = parseInt(jumpInput.value, 10)
  if (!isNaN(addr) && addr >= 0 && addr < RAM_SIZE) {
    scrollToAddress(addr, 'smooth')
  }
}

// ─── Inline-Bearbeitung (Doppelklick) ────────────────────────────────────────
const editingAddress = ref<number | null>(null)
const editValue = ref('')

function startEdit(address: number) {
  editingAddress.value = address
  editValue.value = formatDecimal(store.state.ram[address] ?? 0).replace('.', '')
}

function commitEdit() {
  if (editingAddress.value === null) return
  const raw = parseInt(editValue.value, 10)
  if (!isNaN(raw)) {
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
  <div class="flex flex-col h-full">

    <!-- ─── Jump-to-address Bar ─── -->
    <div class="flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700 shrink-0 text-xs">
      <span class="text-gray-400">Springe zu:</span>
      <input
        v-model="jumpInput"
        type="number"
        min="0"
        max="999"
        placeholder="0–999"
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
        PC: <span class="text-blue-300 font-mono">{{ String(store.state.pc).padStart(3, '0') }}</span>
      </span>
    </div>

    <!-- ─── Tabelle (alle 1000 Zeilen) ─── -->
    <div ref="containerRef" class="overflow-y-auto flex-1">
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
          <tr
            v-for="addr in ALL_ADDRESSES"
            :key="addr"
            :data-addr="addr"
            v-memo="[store.state.ram[addr], store.state.pc === addr, editingAddress === addr]"
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

            <!-- Data im OO.OOO-Format -->
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

            <!-- Note -->
            <td class="px-3 py-0.5 text-gray-500 text-xs italic">
              <span v-if="store.state.pc === addr">← PC</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>
