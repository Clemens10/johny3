import { describe, it, expect } from 'vitest'
import {
  appendSignal, undoLastSignal,
  validateRecording, applyRecording,
} from '../../src/simulator/recorder'
import { Signal, MICROCODE_SIZE } from '../../src/simulator/types'

describe('recorder: Aufnahme einer Befehlssequenz', () => {
  it('append baut Sequenz auf, applyRecording schreibt sie an Einsprungadresse', () => {
    // Simuliere eine TAKE-ähnliche Sequenz: acc:=0, ins-->ab, ram-->db, plus, pc++, mc:=0
    let buffer: Signal[] = []
    buffer = appendSignal(buffer, Signal.ACC_ZERO)
    buffer = appendSignal(buffer, Signal.INS_AB)
    buffer = appendSignal(buffer, Signal.RAM_DB)
    buffer = appendSignal(buffer, Signal.PLUS)
    buffer = appendSignal(buffer, Signal.PC_INC)
    buffer = appendSignal(buffer, Signal.MC_ZERO)

    expect(buffer).toHaveLength(6)

    // In einen freien Bereich schreiben (110, hinter den Defaults)
    const initial = new Array<Signal>(MICROCODE_SIZE).fill(Signal.NOP)
    const { microcode, truncated } = applyRecording(initial, 110, buffer)

    expect(truncated).toBe(false)
    expect(microcode[110]).toBe(Signal.ACC_ZERO)
    expect(microcode[111]).toBe(Signal.INS_AB)
    expect(microcode[112]).toBe(Signal.RAM_DB)
    expect(microcode[113]).toBe(Signal.PLUS)
    expect(microcode[114]).toBe(Signal.PC_INC)
    expect(microcode[115]).toBe(Signal.MC_ZERO)
    // Drumherum unverändert
    expect(microcode[109]).toBe(Signal.NOP)
    expect(microcode[116]).toBe(Signal.NOP)
  })

  it('applyRecording schneidet am Speicher-Ende ab und meldet truncated', () => {
    const initial = new Array<Signal>(MICROCODE_SIZE).fill(Signal.NOP)
    const signals = [Signal.PLUS, Signal.MINUS, Signal.MC_ZERO]
    const { microcode, truncated } = applyRecording(initial, 198, signals)
    expect(truncated).toBe(true)
    expect(microcode[198]).toBe(Signal.PLUS)
    expect(microcode[199]).toBe(Signal.MINUS)
    // MC_ZERO fiel weg — nicht geschrieben
  })

  it('applyRecording wirft bei ungültiger Einsprungadresse', () => {
    const initial = new Array<Signal>(MICROCODE_SIZE).fill(Signal.NOP)
    expect(() => applyRecording(initial, -1, [Signal.MC_ZERO])).toThrow(RangeError)
    expect(() => applyRecording(initial, 200, [Signal.MC_ZERO])).toThrow(RangeError)
  })
})

describe('recorder: Undo entfernt nur den letzten Schritt', () => {
  it('undoLastSignal entfernt genau ein Element vom Ende', () => {
    const buffer: Signal[] = [Signal.PLUS, Signal.MINUS, Signal.PC_INC]
    const result = undoLastSignal(buffer)
    expect(result).toEqual([Signal.PLUS, Signal.MINUS])
  })

  it('lässt die übrigen Schritte unverändert (kein Stack-Reset)', () => {
    const buffer: Signal[] = [Signal.ACC_ZERO, Signal.INS_AB, Signal.RAM_DB]
    const once  = undoLastSignal(buffer)
    const twice = undoLastSignal(once)
    expect(once).toEqual([Signal.ACC_ZERO, Signal.INS_AB])
    expect(twice).toEqual([Signal.ACC_ZERO])
  })

  it('ist no-op bei leerem Buffer', () => {
    expect(undoLastSignal([])).toEqual([])
  })

  it('mutiert den Original-Buffer nicht', () => {
    const buffer: Signal[] = [Signal.PLUS, Signal.MINUS]
    undoLastSignal(buffer)
    expect(buffer).toEqual([Signal.PLUS, Signal.MINUS])
  })
})

describe('recorder: Validierung erkennt fehlendes mc:=0', () => {
  it('warnt wenn das letzte Signal NICHT mc:=0 ist', () => {
    const warnings = validateRecording([Signal.PLUS, Signal.PC_INC])
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/mc:=0/)
  })

  it('keine Warnung bei korrektem Abschluss', () => {
    const warnings = validateRecording([Signal.PLUS, Signal.PC_INC, Signal.MC_ZERO])
    expect(warnings).toEqual([])
  })

  it('warnt bei leerer Sequenz', () => {
    const warnings = validateRecording([])
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toMatch(/leer/)
  })

  it('akzeptiert eine Sequenz aus nur mc:=0 (Trivialfall)', () => {
    expect(validateRecording([Signal.MC_ZERO])).toEqual([])
  })
})
