import { type SimulatorState, type Signal, type Word, RAM_SIZE } from './types'
import { applySignal } from './signals'
import { DEFAULT_MICROCODE } from './microcode'

/** Erzeugt einen frischen Simulator-Zustand (PC=0, alle Register auf 0). */
export function createInitialState(ram?: Word[]): SimulatorState {
  const ramCells = new Array<Word>(RAM_SIZE).fill(0)
  if (ram) {
    const limit = Math.min(ram.length, RAM_SIZE)
    for (let i = 0; i < limit; i++) {
      ramCells[i] = ram[i] ?? 0
    }
  }
  return {
    ram: ramCells,
    microcode: [...DEFAULT_MICROCODE],
    pc: 0,
    ir: 0,
    acc: 0,
    mc: 0,
    dataBus: 0,
    addressBus: 0,
    halted: false,
    activeFeatures: new Set(),
  }
}

/**
 * Führt einen einzelnen Mikroschritt aus.
 *
 * INS_MC (5) und MC_ZERO (7) setzen mc direkt — bei ihnen wird mc NICHT
 * automatisch inkrementiert. Bei allen anderen Signalen wird mc danach um 1
 * erhöht.
 */
export function microstep(state: SimulatorState): SimulatorState {
  if (state.halted) return state

  const signal = (state.microcode[state.mc] ?? 0) as Signal
  let next = applySignal(state, signal)

  // INS_MC = 5, MC_ZERO = 7 setzen mc selbst → kein weiteres Inkrement
  if (signal !== 5 && signal !== 7) {
    next = { ...next, mc: next.mc + 1 }
  }

  return next
}

/**
 * Führt einen vollständigen Befehlsschritt aus (FETCH + Execution bis mc=0).
 * Gibt den Zustand nach dem nächsten mc:=0 zurück.
 */
export function step(state: SimulatorState): SimulatorState {
  if (state.halted) return state
  let s = state
  // Mindestens einen Mikroschritt ausführen, dann bis mc=0 weiter
  do {
    s = microstep(s)
  } while (!s.halted && s.mc !== 0)
  return s
}

/**
 * Führt das Programm bis HLT aus (oder bis maxSteps um Endlosschleifen zu stoppen).
 */
export function run(state: SimulatorState, maxSteps = 200_000): SimulatorState {
  let s = state
  let i = 0
  while (!s.halted && i < maxSteps) {
    s = microstep(s)
    i++
  }
  return s
}
