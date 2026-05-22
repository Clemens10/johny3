import { type Word, type Signal, RAM_SIZE, MICROCODE_SIZE } from './types'
import { AdvancedFeature } from './types'
import { DEFAULT_MICROCODE } from './microcode'

// ─── Konstanten ────────────────────────────────────────────────────────────────

/** Größtes 16-Bit-Wort — Importwerte darüber werten als Fehler in Legacy-Dateien. */
export const RAM_VALUE_MAX = 65535

/** Mnemonics in Opcode-Reihenfolge (Index = Opcode). Opcode 0 = FETCH. */
const INSTRUCTION_MNEMONICS = [
  'FETCH', 'TAKE', 'ADD', 'SUB', 'SAVE', 'JMP', 'TST',
  'INC', 'DEC', 'NULL', 'HLT', 'MUL', 'LOOP', 'TGT',
] as const

export type FileFormat = 'ram' | 'mc' | 'johnny'

/** Erkennt das Dateiformat anhand der Endung. */
export function detectFormat(filename: string): FileFormat | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.ram')) return 'ram'
  if (lower.endsWith('.mc')) return 'mc'
  if (lower.endsWith('.johnny')) return 'johnny'
  return null
}

// ─── Wort ⇄ .ram-Dezimalwert ───────────────────────────────────────────────────
// Das .ram-Format speichert ein Wort als "OO.OOO" ohne Punkt, also
// opcode*1000 + operand. Das kann Operanden nur bis 999 abbilden — eine
// Beschränkung des Original-Johny-Formats (verlustfrei ist nur .johnny).

function ramValueToWord(value: number): Word {
  const opcode = Math.floor(value / 1000)
  const operand = value % 1000
  return ((opcode & 0xF) << 12) | (operand & 0xFFF)
}

function wordToRamValue(word: Word): number {
  const opcode = (word >> 12) & 0xF
  const operand = word & 0xFFF
  return opcode * 1000 + operand
}

// ─── .ram (Legacy: lesen & schreiben) ──────────────────────────────────────────

export interface RamImportResult {
  ram: Word[]
  warnings: string[]
}

/** Liest eine .ram-Datei (1000 Zeilen, eine Dezimalzahl pro Zeile). */
export function importRam(text: string): RamImportResult {
  const warnings: string[] = []
  const lines = text.split(/\r?\n/)
  const ram = new Array<Word>(RAM_SIZE).fill(0)

  for (let i = 0; i < lines.length && i < RAM_SIZE; i++) {
    const raw = lines[i].trim()
    if (raw === '') continue

    let value = parseInt(raw, 10)
    if (isNaN(value)) {
      warnings.push(`Zeile ${i + 1}: '${raw}' ist keine gültige Zahl — als 0 gewertet`)
      value = 0
    }
    if (value > RAM_VALUE_MAX) {
      warnings.push(`Adresse ${i}: Wert ${value} wird auf ${RAM_VALUE_MAX} begrenzt`)
      value = RAM_VALUE_MAX
    } else if (value < 0) {
      warnings.push(`Adresse ${i}: negativer Wert ${value} wird auf 0 gesetzt`)
      value = 0
    }
    ram[i] = ramValueToWord(value)
  }
  return { ram, warnings }
}

/**
 * Schreibt eine .ram-Datei im Original-Johny-Format:
 * 1000 Zeilen, \r\n als Trenner, letzte Zeile ohne abschließendes \n.
 */
export function exportRam(ram: Word[]): string {
  const lines: string[] = []
  for (let i = 0; i < RAM_SIZE; i++) {
    lines.push(String(wordToRamValue(ram[i] ?? 0)))
  }
  return lines.join('\r\n')
}

// ─── .mc (Legacy: lesen & schreiben) ───────────────────────────────────────────

export interface McImportResult {
  microcode: Signal[]
  warnings: string[]
}

/** Liest eine .mc-Datei (200 Steuersignal-Codes, danach optionale Mnemonics). */
export function importMc(text: string): McImportResult {
  const warnings: string[] = []
  const lines = text.split(/\r?\n/)
  const microcode = new Array<number>(MICROCODE_SIZE).fill(0)

  for (let i = 0; i < MICROCODE_SIZE && i < lines.length; i++) {
    const raw = lines[i].trim()
    if (raw === '') continue
    const code = parseInt(raw, 10)
    if (isNaN(code)) {
      warnings.push(`Mikrocode-Zeile ${i + 1}: '${raw}' ist keine gültige Zahl — als 0 gewertet`)
    } else {
      microcode[i] = code
    }
  }
  // Zeilen ab 200 sind die Mnemonics-Liste — für den Simulator nicht nötig.
  return { microcode: microcode as Signal[], warnings }
}

/**
 * Schreibt eine .mc-Datei: 200 Steuersignal-Codes, danach die
 * Mnemonics-Liste (classic, beginnend mit FETCH).
 */
export function exportMc(microcode: Signal[]): string {
  const lines: string[] = []
  for (let i = 0; i < MICROCODE_SIZE; i++) {
    lines.push(String(microcode[i] ?? 0))
  }
  for (let opcode = 0; opcode <= 10; opcode++) {
    lines.push(INSTRUCTION_MNEMONICS[opcode])
  }
  return lines.join('\r\n')
}

// ─── .johnny (neues JSON-Format) ────────────────────────────────────────────────

export interface JohnnyInstruction {
  opcode: number
  mnemonic: string
  entry: number
}

export interface JohnnyFile {
  format: 'johnny'
  version: number
  mode: string
  advancedFeatures: string[]
  ram: Record<string, { value: number; note?: string }>
  microcode: { slots: number[]; instructions: JohnnyInstruction[] }
  labels: Record<string, string>
  editorSource: string
  metadata: { createdAt: string; updatedAt: string; title: string }
}

export interface JohnnyImportResult {
  ram: Word[]
  microcode: Signal[]
  labels: Record<string, string>
  editorSource: string
  mode: string
  advancedFeatures: AdvancedFeature[]
  title: string
  warnings: string[]
}

export interface ExportJohnnyOptions {
  ram: Word[]
  microcode: Signal[]
  editorSource: string
  /** Assembler-Labels als name→Adresse (werden zu Adresse→name invertiert). */
  labels?: Record<string, number>
  mode?: string
  advancedFeatures?: string[]
  title?: string
}

/** Serialisiert den kompletten Workspace als .johnny-JSON. */
export function exportJohnny(opts: ExportJohnnyOptions): string {
  const now = new Date().toISOString()

  // RAM sparse speichern — nur Zellen ≠ 0
  const ram: Record<string, { value: number }> = {}
  for (let i = 0; i < opts.ram.length; i++) {
    const word = opts.ram[i] ?? 0
    if (word !== 0) ram[String(i)] = { value: word }
  }

  // labels: name→Adresse  ⇒  Adresse→name
  const labels: Record<string, string> = {}
  for (const [name, addr] of Object.entries(opts.labels ?? {})) {
    labels[String(addr)] = name
  }

  const file: JohnnyFile = {
    format: 'johnny',
    version: 1,
    mode: opts.mode ?? 'classic',
    advancedFeatures: opts.advancedFeatures ?? [],
    ram,
    microcode: {
      slots: opts.microcode.slice(0, MICROCODE_SIZE).map(s => Number(s)),
      instructions: INSTRUCTION_MNEMONICS.map((mnemonic, opcode) => ({
        opcode, mnemonic, entry: opcode * 10,
      })),
    },
    labels,
    editorSource: opts.editorSource,
    metadata: { createdAt: now, updatedAt: now, title: opts.title ?? 'Johnny-3-Workspace' },
  }
  return JSON.stringify(file, null, 2)
}

/** Liest eine .johnny-Datei und stellt RAM, Mikrocode, Quelltext und Features wieder her. */
export function importJohnny(text: string): JohnnyImportResult {
  const warnings: string[] = []

  let parsed: Partial<JohnnyFile>
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error('Datei ist kein gültiges JSON: ' + (e as Error).message)
  }
  if (parsed?.format !== 'johnny') {
    warnings.push('Datei hat kein Feld "format": "johnny" — Import wird trotzdem versucht')
  }

  // RAM (sparse → dicht)
  const ram = new Array<Word>(RAM_SIZE).fill(0)
  for (const [key, cell] of Object.entries(parsed.ram ?? {})) {
    const addr = parseInt(key, 10)
    if (isNaN(addr) || addr < 0 || addr >= RAM_SIZE) {
      warnings.push(`RAM-Adresse '${key}' ungültig — übersprungen`)
      continue
    }
    let value = Number(cell?.value ?? 0)
    if (value > RAM_VALUE_MAX) {
      warnings.push(`Adresse ${addr}: Wert ${value} wird auf ${RAM_VALUE_MAX} begrenzt`)
      value = RAM_VALUE_MAX
    }
    ram[addr] = value & 0xFFFF
  }

  // Mikrocode
  let microcode = [...DEFAULT_MICROCODE] as Signal[]
  const slots = parsed.microcode?.slots
  if (Array.isArray(slots)) {
    const mc = new Array<number>(MICROCODE_SIZE).fill(0)
    for (let i = 0; i < MICROCODE_SIZE && i < slots.length; i++) {
      mc[i] = Number(slots[i]) || 0
    }
    microcode = mc as Signal[]
  }

  // Advanced-Features
  const validFeatures = new Set<string>(Object.values(AdvancedFeature))
  const advancedFeatures: AdvancedFeature[] = []
  for (const f of parsed.advancedFeatures ?? []) {
    if (validFeatures.has(f)) advancedFeatures.push(f as AdvancedFeature)
    else warnings.push(`Unbekanntes Advanced-Feature '${f}' — ignoriert`)
  }

  return {
    ram,
    microcode,
    labels: parsed.labels ?? {},
    editorSource: typeof parsed.editorSource === 'string' ? parsed.editorSource : '',
    mode: parsed.mode ?? 'classic',
    advancedFeatures,
    title: parsed.metadata?.title ?? '',
    warnings,
  }
}
