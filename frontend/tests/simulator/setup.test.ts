import { describe, it, expect } from 'vitest'
import {
  WORD_MAX, WORD_BITS, OPCODE_BITS, OPERAND_BITS,
  OPCODE_MAX, OPERAND_MAX, RAM_SIZE, MICROCODE_SIZE,
  MICROCODE_STEPS_PER_INSTRUCTION, Signal,
} from '@/simulator/types'

describe('Simulator constants', () => {
  it('word layout is consistent', () => {
    expect(WORD_BITS).toBe(OPCODE_BITS + OPERAND_BITS)
    expect(WORD_MAX).toBe(2 ** WORD_BITS - 1)
    expect(OPCODE_MAX).toBe(2 ** OPCODE_BITS - 1)
    expect(OPERAND_MAX).toBe(2 ** OPERAND_BITS - 1)
  })

  it('microcode space fits all opcodes with headroom', () => {
    // 16 opcodes × 10 slots = 160; spec reserves 200 (40 extra)
    expect(MICROCODE_SIZE).toBeGreaterThanOrEqual((OPCODE_MAX + 1) * MICROCODE_STEPS_PER_INSTRUCTION)
    expect(MICROCODE_SIZE).toBe(200)
  })

  it('RAM_SIZE is 1000', () => {
    expect(RAM_SIZE).toBe(1000)
  })

  it('Signal enum has correct classic codes', () => {
    expect(Signal.NOP).toBe(0)
    expect(Signal.STOP).toBe(19)
    expect(Signal.MUL).toBe(20)
    expect(Signal.SHR).toBe(28)
  })
})
