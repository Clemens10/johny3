import { type SimulatorState, type Word, Signal, WORD_MAX, AdvancedFeature } from './types'

/**
 * Welches Advanced-Feature ein Signal voraussetzt.
 * Nicht gelistete Signale (Codes 0–19) sind Classic und immer verfügbar.
 */
const SIGNAL_FEATURE: Partial<Record<Signal, AdvancedFeature>> = {
  [Signal.MUL]:      AdvancedFeature.F1_MUL,
  [Signal.PC_DEC]:   AdvancedFeature.F2_PC_DEC,
  [Signal.GT_SKIP]:  AdvancedFeature.F3A_GT,
  [Signal.LEQ_SKIP]: AdvancedFeature.F3B_LEQ,
  [Signal.AND]:      AdvancedFeature.F4_BITWISE,
  [Signal.OR]:       AdvancedFeature.F4_BITWISE,
  [Signal.NOT]:      AdvancedFeature.F4_BITWISE,
  [Signal.SHL]:      AdvancedFeature.F4_BITWISE,
  [Signal.SHR]:      AdvancedFeature.F4_BITWISE,
}

/**
 * Ob ein Signal in der UI angeboten werden soll (Recorder-Palette, Mikrocode-
 * Dropdown). Classic-Signale immer; Advanced-Signale nur wenn das zugehörige
 * Feature aktiv ist. Filtert die Palette automatisch beim Wechsel der Modi.
 */
export function isSignalAvailable(signal: Signal, activeFeatures: Set<AdvancedFeature>): boolean {
  const required = SIGNAL_FEATURE[signal]
  return required === undefined || activeFeatures.has(required)
}

/** Hält das Ergebnis auf 16 Bit (funktioniert auch bei negativem Zwischenergebnis). */
function mod16(n: number): Word {
  return ((n % 65536) + 65536) % 65536
}

/**
 * Wendet ein Steuersignal auf den Zustand an und gibt einen neuen Zustand zurück.
 * Alle Funktionen sind pure (keine Seiteneffekte außerhalb des zurückgegebenen Objekts).
 *
 * mc wird hier NICHT inkrementiert — das übernimmt microstep().
 * Ausnahme: INS_MC und MC_ZERO setzen mc direkt; microstep() erkennt das
 * und überspringt das automatische Inkrement.
 */
export function applySignal(state: SimulatorState, signal: Signal): SimulatorState {
  const s = state
  switch (signal) {
    case Signal.NOP:
      return s

    case Signal.PC_AB:      // pc-->ab
      return { ...s, addressBus: s.pc }

    case Signal.RAM_DB:     // ram-->db
      return { ...s, dataBus: s.ram[s.addressBus] ?? 0 }

    case Signal.DB_INS:     // db-->ins
      return { ...s, ir: s.dataBus }

    case Signal.INS_AB:     // ins-->ab (untere 12 Bit des IR = Operand)
      return { ...s, addressBus: s.ir & 0x0FFF }

    case Signal.INS_MC:     // ins-->mc: Opcode × 10 → MC (Decode-Sprung)
      return { ...s, mc: ((s.ir >> 12) & 0xF) * 10 }

    case Signal.ZERO_TEST:  // =0? (Statusleitung für Custom-Mikrocode, im Default nicht genutzt)
      return s

    case Signal.MC_ZERO:    // mc:=0 (zurück zu FETCH)
      return { ...s, mc: 0 }

    case Signal.PC_INC:     // pc++
      return { ...s, pc: (s.pc + 1) & 0x0FFF }

    case Signal.ZERO_SKIP:  // =0:pc++ — PC nur inkrementieren wenn ACC == 0
      return s.acc === 0 ? { ...s, pc: (s.pc + 1) & 0x0FFF } : s

    case Signal.INS_PC:     // ins-->pc (Operand des IR → PC, Sprung)
      return { ...s, pc: s.ir & 0x0FFF }

    case Signal.ACC_ZERO:   // acc:=0
      return { ...s, acc: 0 }

    case Signal.PLUS:       // ACC := (ACC + DB) mod 2^16
      return { ...s, acc: mod16(s.acc + s.dataBus) }

    case Signal.MINUS:      // ACC := (ACC − DB) mod 2^16
      return { ...s, acc: mod16(s.acc - s.dataBus) }

    case Signal.ACC_DB:     // acc-->db
      return { ...s, dataBus: s.acc }

    case Signal.ACC_INC:    // acc++
      return { ...s, acc: mod16(s.acc + 1) }

    case Signal.ACC_DEC:    // acc--
      return { ...s, acc: mod16(s.acc - 1) }

    case Signal.DB_ACC:     // db-->acc
      return { ...s, acc: s.dataBus }

    case Signal.DB_RAM: {   // db-->ram
      const newRam = [...s.ram]
      newRam[s.addressBus] = s.dataBus
      return { ...s, ram: newRam }
    }

    case Signal.STOP:
      return { ...s, halted: true }

    // Advanced-Signale (Codes 20–28)
    case Signal.MUL:        // ACC := (ACC × DB) mod 2^16
      return { ...s, acc: mod16(s.acc * s.dataBus) }

    case Signal.PC_DEC:     // pc--
      return { ...s, pc: (s.pc - 1 + 4096) & 0x0FFF }

    case Signal.GT_SKIP:    // >0:pc++
      return s.acc > 0 ? { ...s, pc: (s.pc + 1) & 0x0FFF } : s

    case Signal.LEQ_SKIP:   // <=0:pc++ (da keine negativen Zahlen: ≡ =0:pc++)
      return s.acc === 0 ? { ...s, pc: (s.pc + 1) & 0x0FFF } : s

    case Signal.AND:        // ACC := ACC AND DB
      return { ...s, acc: (s.acc & s.dataBus) & WORD_MAX }

    case Signal.OR:         // ACC := ACC OR DB
      return { ...s, acc: (s.acc | s.dataBus) & WORD_MAX }

    case Signal.NOT:        // ACC := NOT ACC (Einerkomplement, 16 Bit)
      return { ...s, acc: (~s.acc) & WORD_MAX }

    case Signal.SHL:        // ACC := (ACC << 1) mod 2^16
      return { ...s, acc: (s.acc << 1) & WORD_MAX }

    case Signal.SHR:        // ACC := ACC >> 1
      return { ...s, acc: s.acc >>> 1 }

    default:
      return s
  }
}
