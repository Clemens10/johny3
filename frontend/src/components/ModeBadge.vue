<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { AdvancedFeature } from '@/simulator/types'

const store = useSimulatorStore()
const open  = ref(false)

/** Text im Badge je nach aktivem Modus (Section 5.7). */
const badgeText = computed(() => {
  if (store.mode === 'classic')  return 'Classic'
  if (store.mode === 'advanced') return 'Advanced'
  return `Custom: ${store.state.activeFeatures.size} aktiv`
})

/** Definierte Feature-Toggles aus Section 3.7. */
const FEATURES = [
  {
    key:     AdvancedFeature.F1_MUL,
    label:   'F1: Multiplikation',
    detail:  'mul  — ACC := ACC × DB  (Signal 20)',
  },
  {
    key:     AdvancedFeature.F2_PC_DEC,
    label:   'F2: PC-Dekrement',
    detail:  'pc-- — PC dekrementieren  (Signal 21)',
  },
  {
    key:     AdvancedFeature.F3A_GT,
    label:   'F3a: Größer-Null',
    detail:  '>0:pc++  (Signal 22)',
  },
  {
    key:     AdvancedFeature.F3B_LEQ,
    label:   'F3b: Kleiner-Gleich-Null',
    detail:  '≤0:pc++  (Signal 23)',
  },
  {
    key:     AdvancedFeature.F4_BITWISE,
    label:   'F4: Bitweise Operationen',
    detail:  'and / or / not / shl / shr  (Signale 24–28)',
  },
]
</script>

<template>
  <div class="relative">

    <!-- Badge-Button -->
    <button
      class="px-2 py-0.5 rounded text-xs font-bold border transition-colors"
      :class="{
        'bg-gray-700  border-gray-500  text-gray-300':    store.mode === 'classic',
        'bg-blue-800  border-blue-500  text-blue-200':    store.mode === 'advanced',
        'bg-purple-800 border-purple-500 text-purple-200': store.mode === 'custom',
      }"
      :title="'Modus: ' + badgeText + ' — klicken zum Ändern'"
      @click="open = !open"
    >
      Modus: {{ badgeText }} ▾
    </button>

    <!-- Click-outside-Overlay (hinter dem Panel) -->
    <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />

    <!-- Dropdown-Panel -->
    <Transition name="fade">
      <div
        v-if="open"
        class="absolute top-full left-0 mt-1 z-50 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 text-xs"
      >
        <div class="font-bold text-gray-200 mb-1 text-sm">Advanced-Features</div>
        <p class="text-gray-500 mb-2 text-xs">
          Schaltet zusätzliche Steuersignale und Mikrobefehle frei.
        </p>

        <!-- Schnell-Buttons -->
        <div class="flex gap-2 mb-3">
          <button
            class="flex-1 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-blue-100 font-semibold"
            @click="store.enableAllFeatures()"
          >
            Alle an (Advanced)
          </button>
          <button
            class="flex-1 py-0.5 rounded bg-gray-600 hover:bg-gray-500 text-gray-200 font-semibold"
            @click="store.disableAllFeatures()"
          >
            Alle aus (Classic)
          </button>
        </div>

        <!-- Feature-Liste -->
        <div class="flex flex-col gap-1">
          <label
            v-for="feat in FEATURES"
            :key="feat.key"
            class="flex items-start gap-2 cursor-pointer px-1.5 py-1 rounded hover:bg-gray-700 transition-colors"
          >
            <input
              type="checkbox"
              class="mt-0.5 accent-blue-400 shrink-0"
              :checked="store.state.activeFeatures.has(feat.key)"
              @change="store.toggleFeature(feat.key)"
            />
            <div>
              <div class="text-gray-200 font-medium">{{ feat.label }}</div>
              <div class="text-gray-500">{{ feat.detail }}</div>
            </div>
          </label>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.1s, transform 0.1s; }
.fade-enter-from, .fade-leave-to       { opacity: 0; transform: translateY(-4px); }
</style>
