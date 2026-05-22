import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  importRam, exportRam, importMc, exportMc,
  importJohnny, exportJohnny, detectFormat,
} from '../../src/simulator/fileio'
import { createInitialState, run } from '../../src/simulator/simulator'
import { decode } from '../../src/simulator/format'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => resolve(here, '../fixtures', name)

describe('fileio: .ram', () => {
  it('lädt Mul_3x4.ram, führt aus → MEM[102] = 12 (3 × 4)', () => {
    const text = readFileSync(fixture('Mul_3x4.ram'), 'utf-8')
    const { ram, warnings } = importRam(text)
    expect(warnings).toHaveLength(0)

    const result = run(createInitialState(ram))
    expect(result.halted).toBe(true)
    expect(decode(result.ram[102]).operand).toBe(12)  // Ergebnis 3 × 4
    expect(decode(result.ram[100]).operand).toBe(3)   // Faktor unverändert
  })

  it('Round-Trip: import → export → import bleibt stabil', () => {
    const text = readFileSync(fixture('Mul_3x4.ram'), 'utf-8')
    const { ram } = importRam(text)
    const reimported = importRam(exportRam(ram))
    expect(reimported.ram).toEqual(ram)
  })

  it('export erzeugt 1000 Zeilen mit \\r\\n, letzte ohne \\n', () => {
    const text = exportRam(new Array(1000).fill(0))
    expect(text.split('\r\n')).toHaveLength(1000)
    expect(text.endsWith('\n')).toBe(false)
  })

  it('warnt bei Werten > 65535 und begrenzt sie', () => {
    const { warnings } = importRam('99999\n0\n0')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toMatch(/65535/)
  })

  it('toleriert \\r\\n-Zeilenenden', () => {
    const { ram } = importRam('1101\r\n10000\r\n0')
    expect(decode(ram[0])).toEqual({ opcode: 1, operand: 101 })
    expect(decode(ram[1])).toEqual({ opcode: 10, operand: 0 })
  })
})

describe('fileio: .mc', () => {
  it('Round-Trip Mikrocode (200 Slots)', () => {
    const mc = new Array(200).fill(0)
    mc[0] = 8; mc[1] = 2; mc[2] = 3; mc[3] = 5
    const { microcode } = importMc(exportMc(mc))
    expect(microcode).toHaveLength(200)
    expect(microcode.slice(0, 4)).toEqual([8, 2, 3, 5])
  })

  it('export hängt Mnemonics-Liste nach 200 Slots an, beginnend mit FETCH', () => {
    const lines = exportMc(new Array(200).fill(0)).split('\r\n')
    expect(lines.length).toBeGreaterThan(200)
    expect(lines[200]).toBe('FETCH')
    expect(lines[201]).toBe('TAKE')
  })
})

describe('fileio: .johnny', () => {
  it('Round-Trip: stellt RAM, Quelltext und Labels wieder her', () => {
    const ram = new Array(1000).fill(0)
    ram[0] = (1 << 12) | 101   // TAKE 101
    ram[100] = 3
    const source = '; Testprogramm\nTAKE 101\nHLT'
    const json = exportJohnny({
      ram,
      microcode: new Array(200).fill(0),
      editorSource: source,
      labels: { start: 0, loop: 3 },
    })
    const result = importJohnny(json)
    expect(result.ram[0]).toBe((1 << 12) | 101)
    expect(result.ram[100]).toBe(3)
    expect(result.editorSource).toBe(source)
    expect(result.labels['0']).toBe('start')   // name→addr wird zu addr→name
    expect(result.labels['3']).toBe('loop')
  })

  it('speichert RAM sparse (nur Zellen ≠ 0)', () => {
    const ram = new Array(1000).fill(0)
    ram[42] = 7
    const json = JSON.parse(exportJohnny({ ram, microcode: [], editorSource: '' }))
    expect(Object.keys(json.ram)).toEqual(['42'])
  })

  it('wirft bei ungültigem JSON', () => {
    expect(() => importJohnny('{ kaputt')).toThrow(/JSON/)
  })

  it('warnt bei RAM-Werten > 65535', () => {
    const json = JSON.stringify({ format: 'johnny', ram: { '0': { value: 999999 } } })
    const result = importJohnny(json)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('fileio: detectFormat', () => {
  it('erkennt Endungen (case-insensitive)', () => {
    expect(detectFormat('prog.ram')).toBe('ram')
    expect(detectFormat('prog.mc')).toBe('mc')
    expect(detectFormat('prog.johnny')).toBe('johnny')
    expect(detectFormat('PROG.JOHNNY')).toBe('johnny')
    expect(detectFormat('prog.txt')).toBe(null)
  })
})
