import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type SimulatorState, type Signal, AdvancedFeature, RAM_SIZE, MICROCODE_SIZE } from '@/simulator/types'
import { createInitialState, microstep as doMicrostep } from '@/simulator/simulator'
import { signalName } from '@/simulator/format'

/** Ein Schnappschuss der Register vor/nach einem Mikroschritt — für den Trace. */
interface TraceSnapshot {
  pc: number; ir: number; acc: number; mc: number
  dataBus: number; addressBus: number
}

/** Ein Eintrag im Mikrocode-Trace. */
export interface TraceEntry {
  id: number
  signal: Signal
  signalName: string
  before: TraceSnapshot
  after: TraceSnapshot
}

const TRACE_LIMIT = 50  // Panel zeigt die letzten 20, wir behalten etwas Puffer.

function snapshot(s: SimulatorState): TraceSnapshot {
  return {
    pc: s.pc, ir: s.ir, acc: s.acc, mc: s.mc,
    dataBus: s.dataBus, addressBus: s.addressBus,
  }
}

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

  /** Mikrocode-Trace: jüngste Einträge hinten. Wird vom Trace-Panel angezeigt. */
  const trace = ref<TraceEntry[]>([])
  let traceCounter = 0

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

  /**
   * Führt einen einzelnen Mikroschritt aus UND hängt einen Trace-Eintrag an.
   * Zentrale Stelle — `step()` und der Dauerlauf rufen das in einer Schleife.
   */
  function recordedMicrostep() {
    if (state.value.halted) return
    const before = snapshot(state.value)
    const signal = (state.value.microcode[state.value.mc] ?? 0) as Signal
    const next = doMicrostep(state.value)
    state.value = next
    trace.value.push({
      id: traceCounter++,
      signal,
      signalName: signalName(signal),
      before,
      after: snapshot(next),
    })
    if (trace.value.length > TRACE_LIMIT) {
      trace.value.splice(0, trace.value.length - TRACE_LIMIT)
    }
  }

  /** Führt einen einzelnen Mikroschritt aus. */
  function microstep() {
    recordedMicrostep()
  }

  /** Führt einen vollständigen Befehlsschritt aus (Mikroschritte bis mc=0). */
  function step() {
    if (state.value.halted) return
    do {
      recordedMicrostep()
    } while (!state.value.halted && state.value.mc !== 0)
  }

  /** Startet den Dauerlauf (ein vollständiger Befehl pro Timer-Tick). */
  function startRun() {
    if (isRunning.value || state.value.halted) return
    isRunning.value = true
    runTimer = setInterval(() => {
      step()
      if (state.value.halted) stopRun()
    }, delayMs())
  }

  /** Leert den Mikrocode-Trace (nach Reset oder Datei-Laden). */
  function clearTrace() {
    trace.value = []
    traceCounter = 0
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
    clearTrace()
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
    clearTrace()
    state.value = createInitialState(ram)
  }

  /**
   * Aktualisiert den RAM-Inhalt ohne Register zurückzusetzen.
   * Wird vom Assembler bei jeder Editor-Änderung aufgerufen.
   */
  function updateRam(ram: number[]) {
    const padded = Array.from({ length: RAM_SIZE }, (_, i) => (ram[i] ?? 0) & 0xFFFF)
    state.value = { ...state.value, ram: padded }
  }

  /**
   * Lädt neuen Mikrocode (z. B. aus einer .mc-Datei), RAM bleibt erhalten,
   * Register werden zurückgesetzt.
   */
  function loadMicrocode(microcode: number[]) {
    stopRun()
    clearTrace()
    const padded = Array.from({ length: MICROCODE_SIZE }, (_, i) => microcode[i] ?? 0) as Signal[]
    state.value = { ...createInitialState(state.value.ram), microcode: padded }
  }

  /**
   * Lädt einen vollständigen Workspace (z. B. aus einer .johnny-Datei):
   * RAM, Mikrocode und Advanced-Features. Register werden zurückgesetzt.
   */
  function loadWorkspace(opts: {
    ram?: number[]
    microcode?: number[]
    features?: AdvancedFeature[]
  }) {
    stopRun()
    clearTrace()
    const base = createInitialState(opts.ram)
    state.value = {
      ...base,
      microcode: opts.microcode
        ? (Array.from({ length: MICROCODE_SIZE }, (_, i) => opts.microcode![i] ?? 0) as Signal[])
        : base.microcode,
      activeFeatures: opts.features ? new Set(opts.features) : base.activeFeatures,
    }
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
    trace,
    // Aktionen
    microstep,
    step,
    startRun,
    stopRun,
    toggleRun,
    reset,
    loadRam,
    updateRam,
    loadMicrocode,
    loadWorkspace,
    setRamCell,
    toggleFeature,
    enableAllFeatures,
    disableAllFeatures,
    clearTrace,
  }
})
