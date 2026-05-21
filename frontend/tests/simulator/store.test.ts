import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSimulatorStore } from '@/stores/simulator'

// Kleines Testprogramm: HLT bei Adresse 0
function parseRamWord(display: number): number {
  return ((Math.floor(display / 1000)) << 12) | (display % 1000)
}

const HLT_PROGRAM = Array.from({ length: 1000 }, (_, i) =>
  i === 0 ? parseRamWord(10000) : 0  // HLT bei Adresse 0
)

describe('SimulatorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('startet im Initialzustand (PC=0, nicht angehalten)', () => {
    const store = useSimulatorStore()
    expect(store.isHalted).toBe(false)
    expect(store.pc).toBe(0)
    expect(store.acc).toBe(0)
    expect(store.isRunning).toBe(false)
  })

  it('step() führt einen Befehl aus', () => {
    const store = useSimulatorStore()
    store.loadRam(HLT_PROGRAM)
    store.step()
    expect(store.isHalted).toBe(true)
  })

  it('reset() setzt Register zurück, RAM bleibt', () => {
    const store = useSimulatorStore()
    store.loadRam(HLT_PROGRAM)
    store.step()                       // HLT ausführen
    expect(store.isHalted).toBe(true)
    store.reset()
    expect(store.isHalted).toBe(false)
    expect(store.pc).toBe(0)
    expect(store.state.ram[0]).toBe(parseRamWord(10000))  // RAM erhalten
  })

  it('setRamCell() ändert eine einzelne Zelle', () => {
    const store = useSimulatorStore()
    store.setRamCell(42, 0x1234)
    expect(store.state.ram[42]).toBe(0x1234)
  })

  it('microstep() führt einen einzelnen Mikroschritt aus', () => {
    const store = useSimulatorStore()
    store.loadRam(HLT_PROGRAM)
    expect(store.mc).toBe(0)   // Bei FETCH-Slot 0
    store.microstep()
    expect(store.mc).toBe(1)   // Nach pc-->ab: MC = 1
  })
})
