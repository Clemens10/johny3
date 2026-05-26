import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { type SimulatorState, type Signal, AdvancedFeature, RAM_SIZE, MICROCODE_SIZE } from '@/simulator/types'
import { createInitialState, microstep as doMicrostep } from '@/simulator/simulator'
import { signalName, type WordFormat } from '@/simulator/format'
import { applySignal } from '@/simulator/signals'
import {
  appendSignal as recAppend,
  undoLastSignal as recUndo,
  validateRecording,
  applyRecording,
} from '@/simulator/recorder'

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

  /**
   * Globales Anzeige-Format für Wortinhalte (Schritt 19).
   * Wirkt auf RAM-Tabelle, Mikrocode-Code-Spalte und Register-Anzeigen.
   * Adressen bleiben immer dezimal; Inspector zeigt stets alle drei Formate.
   */
  const wordFormat = ref<WordFormat>('dec')

  // --- Recorder-State ---
  /** Aufnahme-Modus aktiv? Toolbar-Toggle + Banner-Sichtbarkeit. */
  const isRecording = ref(false)
  /** Mnemonic für den neuen Befehl (z. B. "MYCMD"). */
  const recordingMnemonic = ref('')
  /**
   * Einsprungadresse im Mikrocode-Speicher. Default 110 (erster freier Slot
   * hinter den Default-Befehlen 0–105). Im Recorder-Banner editierbar.
   */
  const recordingEntry = ref(110)
  /** Bisher aufgenommene Signale (chronologisch). */
  const recordingSignals = ref<Signal[]>([])
  /** Snapshot des Simulator-States VOR Recorder-Start — zum Zurücksetzen. */
  const recordingStateSnapshot = ref<SimulatorState | null>(null)
  /** State-Historie für Undo im Recorder (State vor jedem Signal). */
  const recordingStateHistory = ref<SimulatorState[]>([])

  // --- Highlight-State (für animierte Signal-Hervorhebungen) ---
  /** Das zuletzt ausgeführte Signal (wird nach ~400 ms gelöscht). */
  const lastExecutedSignal = ref<Signal | null>(null)
  /** Aktuell gehovtertes Signal-Chip (für Pfeil-Vorschau). */
  const hoveredSignal = ref<Signal | null>(null)
  let highlightTimer: ReturnType<typeof setTimeout> | null = null

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

  // --- Private Hilfsfunktionen ---
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

  /**
   * Setzt lastExecutedSignal kurz auf null (damit Vue die CSS-Animation neu
   * triggert, auch wenn dasselbe Signal wie zuvor ausgeführt wird) und dann
   * auf das neue Signal. Nach 400 ms wird es wieder gelöscht.
   */
  function triggerSignalHighlight(signal: Signal) {
    if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null }
    lastExecutedSignal.value = null
    nextTick(() => {
      lastExecutedSignal.value = signal
      highlightTimer = setTimeout(() => {
        lastExecutedSignal.value = null
        highlightTimer = null
      }, 400)
    })
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
    triggerSignalHighlight(signal)
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

  /**
   * Setzt eine einzelne Mikrocode-Zelle (z. B. via Dropdown in der MicrocodeTable).
   * Auch außerhalb des Recorder-Modus erlaubt (siehe INSTRUCTIONS Sec. 5.x).
   */
  function setMicrocodeCell(address: number, signal: Signal) {
    if (address < 0 || address >= MICROCODE_SIZE) return
    const mc = [...state.value.microcode]
    mc[address] = signal
    state.value = { ...state.value, microcode: mc as Signal[] }
  }

  // --- Recorder-Aktionen ---

  /** Aktiviert den Aufnahme-Modus, leert den Buffer und sichert den State. */
  function startRecording() {
    isRecording.value = true
    recordingSignals.value = []
    recordingStateSnapshot.value = state.value
    recordingStateHistory.value = []
  }

  /** Bricht die Aufnahme ohne Übernahme ab und stellt den State wieder her. */
  function cancelRecording() {
    if (recordingStateSnapshot.value) {
      state.value = recordingStateSnapshot.value
    }
    isRecording.value = false
    recordingSignals.value = []
    recordingStateSnapshot.value = null
    recordingStateHistory.value = []
  }

  /**
   * Hängt ein Signal an den Aufnahme-Buffer UND führt es sofort aus,
   * damit Register und Bus-Visualisierung live reagieren.
   * No-op außerhalb Recorder-Modus.
   */
  function recordSignal(signal: Signal) {
    if (!isRecording.value) return
    recordingStateHistory.value = [...recordingStateHistory.value, state.value]
    state.value = applySignal(state.value, signal)
    recordingSignals.value = recAppend(recordingSignals.value, signal)
    triggerSignalHighlight(signal)
  }

  /**
   * Entfernt das zuletzt aufgenommene Signal UND setzt den State auf den
   * Stand vor diesem Signal zurück (Strg+Z im Recorder).
   */
  function undoRecord() {
    if (!isRecording.value) return
    if (recordingStateHistory.value.length > 0) {
      const history = [...recordingStateHistory.value]
      state.value = history.pop()!
      recordingStateHistory.value = history
    }
    recordingSignals.value = recUndo(recordingSignals.value)
  }

  /**
   * Schreibt die aufgenommene Sequenz in den Mikrocode-Speicher, stellt den
   * Register-State auf den Stand VOR der Aufnahme zurück und verlässt den
   * Recorder-Modus. Gibt mögliche Warnungen zurück (z. B. fehlendes mc:=0
   * oder Abschneiden am Speicher-Ende).
   *
   * Mit `force=false` (Default) wird bei Warnungen NICHT gespeichert — die
   * UI soll die Warnungen anzeigen und erst nach Bestätigung mit force=true
   * erneut aufrufen.
   */
  function commitRecording(force = false): string[] {
    const warnings = validateRecording(recordingSignals.value)
    if (warnings.length > 0 && !force) return warnings
    const baseMicrocode = recordingStateSnapshot.value?.microcode ?? state.value.microcode
    const { microcode, truncated } = applyRecording(
      baseMicrocode,
      recordingEntry.value,
      recordingSignals.value,
    )
    // State auf Snapshot zurücksetzen, aber mit dem neuen Mikrocode
    const baseState = recordingStateSnapshot.value ?? state.value
    state.value = { ...baseState, microcode: microcode as Signal[] }
    if (truncated) warnings.push('Sequenz wurde am Ende des Mikrocode-Speichers (Adresse 199) abgeschnitten.')
    isRecording.value = false
    recordingSignals.value = []
    recordingStateSnapshot.value = null
    recordingStateHistory.value = []
    return warnings
  }

  /** Setzt das aktuell gehovterte Signal (für Pfeil-Vorschau in der Bus-Vis.). */
  function setHoveredSignal(signal: Signal | null) {
    hoveredSignal.value = signal
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
    wordFormat,
    // Highlight-State
    lastExecutedSignal,
    hoveredSignal,
    // Recorder-State
    isRecording,
    recordingMnemonic,
    recordingEntry,
    recordingSignals,
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
    setMicrocodeCell,
    toggleFeature,
    enableAllFeatures,
    disableAllFeatures,
    clearTrace,
    setHoveredSignal,
    // Recorder-Aktionen
    startRecording,
    cancelRecording,
    recordSignal,
    undoRecord,
    commitRecording,
  }
})
