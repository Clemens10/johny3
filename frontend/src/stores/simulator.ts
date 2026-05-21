import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type SimulatorState, AdvancedFeature } from '@/simulator/types'
import {
  createInitialState,
  microstep as doMicrostep,
  step as doStep,
} from '@/simulator/simulator'

const ALL_FEATURES = Object.values(AdvancedFeature)

/**
 * Zentraler Simulator-Store.
 * Kapselt den unveränderlichen SimulatorState und bietet reaktive
 * Aktionen für Toolbar und Tastaturkürzel.
 */
export const useSimulatorStore = defineStore('simulator', () => {
  // --- State ---
  const state = ref<SimulatorState>(createInitialState())
  const isRunning = ref(false)

  /**
   * Geschwindigkeit des Dauerlaufs (1–10).
   * 1 = 1 Schritt/Sek, 10 = ~20 Schritte/Sek.
   */
  const speed = ref(3)

  let runTimer: ReturnType<typeof setInterval> | null = null

  // --- Computed ---
  const isHalted = computed(() => state.value.halted)
  const pc       = computed(() => state.value.pc)
  const acc      = computed(() => state.value.acc)
  const mc       = computed(() => state.value.mc)
  const ir       = computed(() => state.value.ir)

  /** 'classic' | 'advanced' | 'custom' — für den Mode-Badge. */
  const mode = computed((): 'classic' | 'advanced' | 'custom' => {
    const n = state.value.activeFeatures.size
    if (n === 0) return 'classic'
    if (n === ALL_FEATURES.length) return 'advanced'
    return 'custom'
  })

  // --- Private Hilfsfunktion ---
  function clearTimer() {
    if (runTimer !== null) {
      clearInterval(runTimer)
      runTimer = null
    }
  }

  function delayMs(): number {
    // speed 1 = 1000 ms, speed 10 = 50 ms (Logarithmus-ähnliche Verteilung)
    return Math.round(1000 / speed.value)
  }

  // --- Aktionen ---

  /** Führt einen einzelnen Mikroschritt aus. */
  function microstep() {
    state.value = doMicrostep(state.value)
  }

  /** Führt einen vollständigen Befehlsschritt aus (FETCH + Execution). */
  function step() {
    state.value = doStep(state.value)
  }

  /** Startet den Dauerlauf (Befehl pro Timer-Tick). */
  function startRun() {
    if (isRunning.value || state.value.halted) return
    isRunning.value = true
    runTimer = setInterval(() => {
      state.value = doStep(state.value)
      if (state.value.halted) stopRun()
    }, delayMs())
  }

  /** Hält den Dauerlauf an. */
  function stopRun() {
    clearTimer()
    isRunning.value = false
  }

  /** Startet oder stoppt den Dauerlauf (Toggle für F5). */
  function toggleRun() {
    if (isRunning.value) stopRun()
    else startRun()
  }

  /**
   * Setzt Register auf 0 zurück, RAM und Mikrocode bleiben erhalten.
   * Nützlich um dasselbe Programm neu zu starten.
   */
  function reset() {
    stopRun()
    state.value = {
      ...state.value,
      pc: 0,
      ir: 0,
      acc: 0,
      mc: 0,
      dataBus: 0,
      addressBus: 0,
      halted: false,
    }
  }

  /**
   * Lädt neuen RAM-Inhalt und setzt alle Register zurück.
   * Wird beim Öffnen einer Datei oder nach dem Assemblieren aufgerufen.
   */
  function loadRam(ram: number[]) {
    stopRun()
    state.value = createInitialState(ram)
  }

  /**
   * Setzt eine einzelne RAM-Zelle (z. B. bei direkter Tabellenbearbeitung).
   */
  function setRamCell(address: number, value: number) {
    const newRam = [...state.value.ram]
    newRam[address] = value & 0xFFFF
    state.value = { ...state.value, ram: newRam }
  }

  /** Schaltet ein einzelnes Advanced-Feature ein oder aus. */
  function toggleFeature(feature: typeof AdvancedFeature[keyof typeof AdvancedFeature]) {
    const features = new Set(state.value.activeFeatures)
    if (features.has(feature)) features.delete(feature)
    else features.add(feature)
    state.value = { ...state.value, activeFeatures: features }
  }

  /** Aktiviert alle Advanced-Features (Advanced-Modus). */
  function enableAllFeatures() {
    state.value = { ...state.value, activeFeatures: new Set(ALL_FEATURES) }
  }

  /** Deaktiviert alle Advanced-Features (Classic-Modus). */
  function disableAllFeatures() {
    state.value = { ...state.value, activeFeatures: new Set() }
  }

  return {
    // State (readonly für Komponenten)
    state,
    isRunning,
    isHalted,
    speed,
    mode,
    pc,
    acc,
    mc,
    ir,
    // Aktionen
    microstep,
    step,
    startRun,
    stopRun,
    toggleRun,
    reset,
    loadRam,
    setRamCell,
    toggleFeature,
    enableAllFeatures,
    disableAllFeatures,
  }
})
