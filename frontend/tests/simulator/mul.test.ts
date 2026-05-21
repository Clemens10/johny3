import { describe, it, expect } from 'vitest'
import { createInitialState, run, step, microstep } from '@/simulator/simulator'

/**
 * Konvertiert einen .ram-Anzeigewert (Format OO.OOO ohne Punkt) in ein 16-Bit-Wort.
 * Beispiel: 1101 → Opcode 01, Operand 101 → (1 << 12) | 101 = 4197
 */
function parseRamWord(display: number): number {
  const opcode  = Math.floor(display / 1000)
  const operand = display % 1000
  return (opcode << 12) | operand
}

// Multiplikationsprogramm aus Mul_3x4.ram (Section 12 der Spezifikation)
// MEM[102] := MEM[100] × MEM[101] via wiederholte Addition
const PROGRAM_RAM = [
  1101, 4103, 9102,       // 0: TAKE 101 | 1: SAVE 103 | 2: NULL 102
  6103, 5006, 5012,       // 3: TST 103  | 4: JMP 006  | 5: JMP 012
  1102, 2100, 4102,       // 6: TAKE 102 | 7: ADD 100  | 8: SAVE 102
  8103, 5003,             // 9: DEC 103  | 10: JMP 003
  0,                      // 11: leer
  10000,                  // 12: HLT
].map(parseRamWord)

function buildState(a: number, b: number) {
  const ram = [...PROGRAM_RAM]
  ram[100] = a  // Faktor a
  ram[101] = b  // Faktor b (= Zähler)
  return createInitialState(ram)
}

describe('Simulator: Multiplikationsprogramm', () => {
  it('3 × 4 = 12', () => {
    const final = run(buildState(3, 4))
    expect(final.halted).toBe(true)
    expect(final.ram[102]).toBe(12)
    expect(final.ram[101]).toBe(4)  // MEM[101] darf nicht verändert werden
  })

  it('0 × 5 = 0', () => {
    const final = run(buildState(0, 5))
    expect(final.halted).toBe(true)
    expect(final.ram[102]).toBe(0)
  })

  it('7 × 1 = 7', () => {
    const final = run(buildState(7, 1))
    expect(final.halted).toBe(true)
    expect(final.ram[102]).toBe(7)
  })

  it('100 × 100 = 10000', () => {
    const final = run(buildState(100, 100))
    expect(final.halted).toBe(true)
    expect(final.ram[102]).toBe(10000)
  })
})

describe('Simulator: microstep() und step()', () => {
  it('step() führt genau einen Befehl aus', () => {
    // Nach TAKE 101 muss PC=1 und ACC=4 sein
    const s0 = buildState(3, 4)
    const s1 = step(s0)
    expect(s1.pc).toBe(1)
    expect(s1.acc).toBe(4)   // TAKE 101 lädt MEM[101]=4
    expect(s1.mc).toBe(0)    // zurück bei FETCH
  })

  it('step() auf halted-Zustand ändert nichts', () => {
    const s0 = buildState(3, 4)
    const final = run(s0)
    expect(final.halted).toBe(true)
    const again = step(final)
    expect(again).toBe(final)  // identisches Objekt
  })

  it('microstep() auf halted-Zustand ändert nichts', () => {
    const s0 = buildState(3, 4)
    const final = run(s0)
    const again = microstep(final)
    expect(again).toBe(final)
  })
})

describe('Simulator: Modulo-Arithmetik', () => {
  it('ACC-Überlauf bei Addition wird auf 16 Bit begrenzt', () => {
    // RAM[0] = ADD 1, RAM[1] = 65535 (max Word)
    const ram: number[] = new Array(1000).fill(0)
    ram[0] = parseRamWord(2001)   // ADD 001
    ram[1] = 65535                // MEM[1] = 0xFFFF
    // ACC startet bei 0, nach ADD: (0 + 65535) = 65535 — kein Überlauf
    const s0 = createInitialState(ram)
    const s1 = step(s0)
    expect(s1.acc).toBe(65535)
  })
})
