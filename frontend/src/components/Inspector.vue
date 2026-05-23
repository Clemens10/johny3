<script setup lang="ts">
import { computed } from 'vue'
import { formatDecimal, formatBinary, formatHex, disassemble } from '@/simulator/format'

/**
 * Hover-Tooltip, der ein RAM-Wort gleichzeitig in allen Sichten zeigt:
 * Dezimal (OO.OOO), Binär, Hex und disassembliert.
 *
 * x/y sind die Cursor-Koordinaten (clientX/clientY). Der Tooltip wird
 * oberhalb des Cursors gezeichnet, weil die RAM-Tabelle ganz unten
 * am Bildschirmrand sitzt — unterhalb wäre kein Platz.
 */
const props = defineProps<{
  address: number
  word: number
  x: number
  y: number
}>()

// Geschätzte Tooltip-Breite, um am rechten Rand nach links zu klappen.
const TOOLTIP_WIDTH = 260

const style = computed(() => {
  const flipLeft = props.x + 16 + TOOLTIP_WIDTH > window.innerWidth
  return {
    left:  flipLeft ? 'auto' : `${props.x + 16}px`,
    right: flipLeft ? `${window.innerWidth - props.x + 16}px` : 'auto',
    top:   `${props.y - 8}px`,
  }
})

const rows = computed(() => [
  { label: 'Wert',  value: formatDecimal(props.word), accent: 'text-gray-100' },
  { label: 'Binär', value: formatBinary(props.word),  accent: 'text-gray-100' },
  { label: 'Hex',   value: formatHex(props.word),     accent: 'text-gray-100' },
  { label: 'Asm',   value: disassemble(props.word),   accent: 'text-green-400' },
])
</script>

<template>
  <div
    class="fixed z-50 pointer-events-none -translate-y-full
           bg-gray-950 border border-gray-600 rounded-md shadow-xl
           px-3 py-2 text-xs font-mono"
    :style="style"
  >
    <div class="text-blue-300 font-semibold mb-1 pb-1 border-b border-gray-700">
      Adresse {{ String(address).padStart(3, '0') }}
    </div>
    <table>
      <tbody>
        <tr v-for="r in rows" :key="r.label">
          <td class="text-gray-500 pr-3">{{ r.label }}</td>
          <td :class="r.accent">{{ r.value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
