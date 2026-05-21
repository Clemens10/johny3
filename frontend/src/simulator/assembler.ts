import { type Word, RAM_SIZE, OPERAND_MAX } from './types'

// ─── Opcode-Tabelle ───────────────────────────────────────────────────────────
const OPCODES: Record<string, number> = {
  TAKE: 1, ADD: 2, SUB: 3, SAVE: 4,
  JMP:  5, TST: 6, INC: 7, DEC: 8,
  NULL: 9, HLT: 10,
  // Advanced
  MUL: 11, LOOP: 12, TGT: 13,
}

// ─── Öffentliche Typen ────────────────────────────────────────────────────────
export interface AssemblerError {
  line: number      // 1-basiert (für Monaco-Marker)
  message: string
}

export interface AssemblerResult {
  ram: Word[]
  errors: AssemblerError[]
  warnings: AssemblerError[]
  labels: Record<string, number>  // name → Adresse
}

// ─── Interner Typ für aufgeschobene Operanden ─────────────────────────────────
interface PendingCell {
  address: number
  labelRef: string
  line: number
}

// ─── Zwei-Pass-Assembler ──────────────────────────────────────────────────────

export function assemble(source: string): AssemblerResult {
  const lines = source.split('\n')
  const errors: AssemblerError[] = []
  const warnings: AssemblerError[] = []
  const labels: Record<string, number> = {}
  const ram: Word[] = new Array(RAM_SIZE).fill(0)

  // Ausstehende Label-Referenzen, die erst in Pass 2 aufgelöst werden
  const pending: PendingCell[] = []

  let address = 0

  // ─── Pass 1: Labels sammeln & Befehle generieren ──────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    let text = lines[i]

    // Kommentar entfernen
    const semi = text.indexOf(';')
    if (semi !== -1) text = text.slice(0, semi)
    text = text.trim()
    if (text === '') continue

    // Label extrahieren (optional)
    const labelMatch = text.match(/^([a-zA-Z_]\w*)\s*:\s*/)
    if (labelMatch) {
      const labelName = labelMatch[1]
      if (labels[labelName] !== undefined) {
        errors.push({ line: lineNo, message: `Label '${labelName}' doppelt definiert` })
      } else {
        labels[labelName] = address
      }
      text = text.slice(labelMatch[0].length).trim()
      if (text === '') continue
    }

    // Mnemonic parsen
    const parts = text.split(/\s+/)
    const mnemonic = parts[0].toUpperCase()

    if (!(mnemonic in OPCODES)) {
      errors.push({ line: lineNo, message: `Unbekannter Befehl '${parts[0]}'` })
      address++
      continue
    }

    const opcode = OPCODES[mnemonic]

    // ─── Adressgrenze prüfen ────────────────────────────────────────────────
    if (address >= RAM_SIZE) {
      errors.push({ line: lineNo, message: `Programm überschreitet RAM-Größe (${RAM_SIZE} Zellen)` })
      break
    }

    // ─── HLT: kein Operand ──────────────────────────────────────────────────
    if (mnemonic === 'HLT') {
      ram[address++] = opcode << 12
      continue
    }

    // ─── LOOP: zwei Operanden (Zähler-Adresse, Sprungziel) ──────────────────
    // LOOP belegt 2 RAM-Zellen: erste = (12 << 12) | counter_addr
    //                           zweite = (0 << 12) | target_addr
    if (mnemonic === 'LOOP') {
      if (parts.length < 3) {
        errors.push({ line: lineNo, message: `LOOP erwartet zwei Operanden: LOOP <Zähler> <Ziel>` })
        address += 2
        continue
      }

      // Zähler-Adresse (erster Operand)
      const counterCell = address++
      resolveOperand(parts[1], opcode, counterCell, lineNo, ram, labels, pending, errors)

      // Sprungziel (zweiter Operand, Opcode 0)
      const targetCell = address++
      resolveOperand(parts[2], 0, targetCell, lineNo, ram, labels, pending, errors)
      continue
    }

    // ─── Normale Befehle: ein Operand ───────────────────────────────────────
    if (parts.length < 2) {
      errors.push({ line: lineNo, message: `'${mnemonic}' erwartet einen Operanden` })
      address++
      continue
    }

    const cell = address++
    resolveOperand(parts[1], opcode, cell, lineNo, ram, labels, pending, errors)
  }

  // ─── Pass 2: ausstehende Label-Referenzen auflösen ────────────────────────
  for (const { address: cell, labelRef, line } of pending) {
    const target = labels[labelRef]
    if (target === undefined) {
      errors.push({ line, message: `Unbekanntes Label '${labelRef}'` })
    } else {
      const opcode = (ram[cell] >> 12) & 0xF
      ram[cell] = encodeWord(opcode, target, line, errors)
    }
  }

  // ─── Warnungen ────────────────────────────────────────────────────────────
  if (address === 0 && errors.length === 0) {
    warnings.push({ line: 1, message: 'Programm ist leer' })
  }

  return { ram, errors, warnings, labels }
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function resolveOperand(
  token: string,
  opcode: number,
  cell: number,
  line: number,
  ram: Word[],
  labels: Record<string, number>,
  pending: PendingCell[],
  errors: AssemblerError[],
): void {
  const num = Number(token)

  if (!isNaN(num) && token.trim() !== '') {
    // Numerischer Operand
    ram[cell] = encodeWord(opcode, num, line, errors)
  } else if (/^[a-zA-Z_]\w*$/.test(token)) {
    // Label-Referenz — jetzt oder später auflösen
    const known = labels[token]
    if (known !== undefined) {
      ram[cell] = encodeWord(opcode, known, line, errors)
    } else {
      // Vorwärts-Referenz: Zelle jetzt mit Opcode belegen, Operand kommt in Pass 2
      ram[cell] = opcode << 12
      pending.push({ address: cell, labelRef: token, line })
    }
  } else {
    errors.push({ line, message: `Ungültiger Operand '${token}'` })
    ram[cell] = opcode << 12
  }
}

function encodeWord(opcode: number, operand: number, line: number, errors: AssemblerError[]): Word {
  if (!Number.isInteger(operand) || operand < 0 || operand > OPERAND_MAX) {
    errors.push({ line, message: `Operand ${operand} außerhalb des gültigen Bereichs (0–${OPERAND_MAX})` })
    operand = Math.max(0, Math.min(OPERAND_MAX, Math.floor(operand)))
  }
  return ((opcode & 0xF) << 12) | (operand & 0xFFF)
}
