import { type Word, WORD_MAX, RAM_SIZE } from './types'

/**
 * Hilfsklasse für RAM-Zugriff mit Bounds-Checks.
 * Der Simulator selbst arbeitet mit Word[] direkt (für Pure-Functions-Design),
 * diese Klasse wird für Datei-I/O und externe Schnittstellen genutzt.
 */
export class Ram {
  private cells: Word[]

  constructor(size: number = RAM_SIZE) {
    this.cells = new Array<Word>(size).fill(0)
  }

  get(address: number): Word {
    if (address < 0 || address >= this.cells.length) {
      throw new RangeError(`RAM-Adresse ${address} außerhalb [0, ${this.cells.length - 1}]`)
    }
    return this.cells[address]!
  }

  set(address: number, value: Word): void {
    if (address < 0 || address >= this.cells.length) {
      throw new RangeError(`RAM-Adresse ${address} außerhalb [0, ${this.cells.length - 1}]`)
    }
    this.cells[address] = value & WORD_MAX  // auf 16 Bit begrenzen
  }

  get size(): number {
    return this.cells.length
  }

  /** Gibt eine Kopie aller Zellen zurück. */
  snapshot(): Word[] {
    return [...this.cells]
  }

  /** Lädt ein Array von Werten (zu kurze Arrays lassen Rest auf 0). */
  load(values: Word[]): void {
    for (let i = 0; i < Math.min(values.length, this.cells.length); i++) {
      this.cells[i] = ((values[i] ?? 0) & WORD_MAX)
    }
  }
}
