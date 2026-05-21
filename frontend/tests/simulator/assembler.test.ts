import { describe, it, expect } from 'vitest'
import { assemble } from '../../src/simulator/assembler'

// Hilfsfunktion: Wort aus Opcode + Operand
function word(opcode: number, operand: number): number {
  return (opcode << 12) | operand
}

describe('assemble', () => {
  it('einfaches Programm ohne Labels', () => {
    const src = `
      TAKE 5
      ADD  3
      HLT
    `
    const { ram, errors } = assemble(src)
    expect(errors).toHaveLength(0)
    expect(ram[0]).toBe(word(1, 5))   // TAKE 5
    expect(ram[1]).toBe(word(2, 3))   // ADD 3
    expect(ram[2]).toBe(word(10, 0))  // HLT
    expect(ram[3]).toBe(0)            // Rest leer
  })

  it('Labels werden zu Adressen aufgelöst', () => {
    const src = `
start:  TAKE 100
        JMP  start
        HLT
    `
    const { ram, errors } = assemble(src)
    expect(errors).toHaveLength(0)
    expect(ram[0]).toBe(word(1, 100))  // TAKE 100
    expect(ram[1]).toBe(word(5, 0))    // JMP 0  (start = Adresse 0)
    expect(ram[2]).toBe(word(10, 0))   // HLT
  })

  it('Vorwärts-Referenzen auf Labels', () => {
    const src = `
      JMP  end
      TAKE 0
end:  HLT
    `
    const { ram, errors } = assemble(src)
    expect(errors).toHaveLength(0)
    expect(ram[0]).toBe(word(5, 2))   // JMP 2  (end = Adresse 2)
    expect(ram[1]).toBe(word(1, 0))   // TAKE 0
    expect(ram[2]).toBe(word(10, 0))  // HLT
  })

  it('Kommentare werden ignoriert', () => {
    const src = `
      ; das ist ein Kommentar
      TAKE 42  ; Inline-Kommentar
      HLT
    `
    const { ram, errors } = assemble(src)
    expect(errors).toHaveLength(0)
    expect(ram[0]).toBe(word(1, 42))
    expect(ram[1]).toBe(word(10, 0))
  })

  it('unbekannter Befehl → Fehler', () => {
    const { errors } = assemble('UNKNOWN 0')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/Unbekannter Befehl/i)
  })

  it('unbekanntes Label → Fehler', () => {
    const { errors } = assemble('JMP nirvana')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/Unbekanntes Label/i)
  })

  it('doppeltes Label → Fehler', () => {
    const src = `
start: HLT
start: TAKE 0
    `
    const { errors } = assemble(src)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toMatch(/doppelt definiert/i)
  })

  it('fehlender Operand → Fehler', () => {
    const { errors } = assemble('TAKE')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('labels map enthält alle definierten Labels', () => {
    const src = `
start: TAKE 100
loop:  ADD  101
       HLT
    `
    const { labels } = assemble(src)
    expect(labels['start']).toBe(0)
    expect(labels['loop']).toBe(1)
  })

  it('Multiplikationsprogramm aus INSTRUCTIONS.md', () => {
    const src = `
        TAKE 101        ; Zähler kopieren
        SAVE 103
        NULL 102        ; Ergebnis nullen

loop:   TST  103        ; fertig?
        JMP  body
        JMP  end

body:   TAKE 102        ; result += a
        ADD  100
        SAVE 102
        DEC  103
        JMP  loop

end:    HLT
    `
    const { ram, errors, labels } = assemble(src)
    expect(errors).toHaveLength(0)

    // Prüfe Label-Adressen
    expect(labels['loop']).toBe(3)
    expect(labels['body']).toBe(6)
    expect(labels['end']).toBe(11)

    // Prüfe erste Befehle
    expect(ram[0]).toBe(word(1,  101))  // TAKE 101
    expect(ram[1]).toBe(word(4,  103))  // SAVE 103
    expect(ram[2]).toBe(word(9,  102))  // NULL 102

    // loop-Block
    expect(ram[3]).toBe(word(6,  103))  // TST  103
    expect(ram[4]).toBe(word(5,  6))    // JMP  body (6)
    expect(ram[5]).toBe(word(5,  11))   // JMP  end (11)

    // body-Block
    expect(ram[6]).toBe(word(1,  102))  // TAKE 102
    expect(ram[7]).toBe(word(2,  100))  // ADD  100
    expect(ram[8]).toBe(word(4,  102))  // SAVE 102
    expect(ram[9]).toBe(word(8,  103))  // DEC  103
    expect(ram[10]).toBe(word(5, 3))    // JMP  loop (3)

    // end
    expect(ram[11]).toBe(word(10, 0))   // HLT
  })

  it('LOOP-Befehl belegt zwei RAM-Zellen', () => {
    const src = `
counter: HLT         ; Platzhalter — Adresse 0
target:  TAKE 0      ; Adresse 1
         LOOP counter target
    `
    const { ram, errors } = assemble(src)
    expect(errors).toHaveLength(0)
    expect(ram[2]).toBe(word(12, 0))  // LOOP mit counter=0
    expect(ram[3]).toBe(word(0,  1))  // target=1
  })

  it('leeres Programm erzeugt eine Warnung', () => {
    const { warnings, errors } = assemble('')
    expect(errors).toHaveLength(0)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('Zeilennummern in Fehlern sind korrekt (1-basiert)', () => {
    const src = `TAKE 5\nBAD 0\nHLT`
    const { errors } = assemble(src)
    expect(errors[0].line).toBe(2)
  })
})
