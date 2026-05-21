import { type Word, OPCODE_MAX } from './types'

/** Opcode → Mnemonic-Mapping für die Classic-Befehle. */
const MNEMONICS: Record<number, string> = {
  0:  '—',
  1:  'TAKE',
  2:  'ADD',
  3:  'SUB',
  4:  'SAVE',
  5:  'JMP',
  6:  'TST',
  7:  'INC',
  8:  'DEC',
  9:  'NULL',
  10: 'HLT',
  // 11–15: Advanced (noch ohne Mnemonic im Classic-Modus)
}

/** Dekodiert ein 16-Bit-Wort in Opcode und Operand. */
export function decode(word: Word): { opcode: number; operand: number } {
  return {
    opcode:  (word >> 12) & 0xF,
    operand:  word & 0x0FFF,
  }
}

/**
 * Formatiert ein Wort im Johny-Dezimalformat "OO.OOO".
 * Entspricht der Originalanzeige (Opcode zweistellig, Operand dreistellig).
 */
export function formatDecimal(word: Word): string {
  const { opcode, operand } = decode(word)
  const op = String(opcode).padStart(2, '0')
  const opr = String(operand).padStart(3, '0')
  return `${op}.${opr}`
}

/** Formatiert ein Wort als Hex: "0x1A2B". */
export function formatHex(word: Word): string {
  return '0x' + word.toString(16).toUpperCase().padStart(4, '0')
}

/** Formatiert ein Wort als 16-Bit-Binär mit Leerzeichen zur Lesbarkeit. */
export function formatBinary(word: Word): string {
  const bits = word.toString(2).padStart(16, '0')
  return bits.slice(0, 4) + ' ' + bits.slice(4, 8) + ' ' + bits.slice(8, 12) + ' ' + bits.slice(12)
}

/** Gibt den Mnemonic für einen Opcode zurück (oder leer wenn unbekannt). */
export function getMnemonic(opcode: number): string {
  if (opcode < 0 || opcode > OPCODE_MAX) return '?'
  return MNEMONICS[opcode] ?? `OP${opcode}`
}

/** Disassembliert ein 16-Bit-Wort zu "MNEMONIC operand", z. B. "TAKE 5". */
export function disassemble(word: Word): string {
  const { opcode, operand } = decode(word)
  const mnemonic = getMnemonic(opcode)
  if (opcode === 0) return '—'     // leere Zelle / reiner Datenwert
  if (opcode === 10) return 'HLT'  // kein Operand
  return `${mnemonic} ${operand}`
}
