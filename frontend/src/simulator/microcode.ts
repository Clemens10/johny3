import { Signal, type Signal as SignalType, MICROCODE_SIZE } from './types'

// Default-Mikrocode für alle Classic-Befehle (Section 3.6 der Spezifikation).
// Index N = Mikrocode-Slot N. Einsprung für Opcode O: O × 10.
const slots = new Array<SignalType>(MICROCODE_SIZE).fill(Signal.NOP)

// FETCH (Entry 0, wird von allen Befehlen geteilt):
// pc-->ab, ram-->db, db-->ins, ins-->mc
slots[0] = Signal.PC_AB
slots[1] = Signal.RAM_DB
slots[2] = Signal.DB_INS
slots[3] = Signal.INS_MC

// TAKE (Entry 10, Opcode 1): acc:=0 → ins-->ab → ram-->db → plus → pc++ → mc:=0
// "TAKE ist als acc:=0 + plus implementiert, nicht als direktes Laden" (Section 3.5)
slots[10] = Signal.ACC_ZERO
slots[11] = Signal.INS_AB
slots[12] = Signal.RAM_DB
slots[13] = Signal.PLUS
slots[14] = Signal.PC_INC
slots[15] = Signal.MC_ZERO

// ADD (Entry 20, Opcode 2): ins-->ab → ram-->db → plus → pc++ → mc:=0
slots[20] = Signal.INS_AB
slots[21] = Signal.RAM_DB
slots[22] = Signal.PLUS
slots[23] = Signal.PC_INC
slots[24] = Signal.MC_ZERO

// SUB (Entry 30, Opcode 3): ins-->ab → ram-->db → minus → pc++ → mc:=0
slots[30] = Signal.INS_AB
slots[31] = Signal.RAM_DB
slots[32] = Signal.MINUS
slots[33] = Signal.PC_INC
slots[34] = Signal.MC_ZERO

// SAVE (Entry 40, Opcode 4): ins-->ab → acc-->db → db-->ram → pc++ → mc:=0
slots[40] = Signal.INS_AB
slots[41] = Signal.ACC_DB
slots[42] = Signal.DB_RAM
slots[43] = Signal.PC_INC
slots[44] = Signal.MC_ZERO

// JMP (Entry 50, Opcode 5): ins-->pc → mc:=0
slots[50] = Signal.INS_PC
slots[51] = Signal.MC_ZERO

// TST (Entry 60, Opcode 6): ins-->ab → ram-->db → db-->acc → =0:pc++ → pc++ → mc:=0
// Zerstört ACC (didaktisch gewollt). Überspringt nächsten Befehl wenn MEM[adr]==0.
slots[60] = Signal.INS_AB
slots[61] = Signal.RAM_DB
slots[62] = Signal.DB_ACC
slots[63] = Signal.ZERO_SKIP   // =0:pc++ (überspringt JMP body wenn Zähler=0)
slots[64] = Signal.PC_INC      // pc++ (überspringt JMP end)
slots[65] = Signal.MC_ZERO

// INC (Entry 70, Opcode 7): acc:=0 → ins-->ab → ram-->db → plus → acc++ → acc-->db → db-->ram → pc++ → mc:=0
slots[70] = Signal.ACC_ZERO
slots[71] = Signal.INS_AB
slots[72] = Signal.RAM_DB
slots[73] = Signal.PLUS
slots[74] = Signal.ACC_INC
slots[75] = Signal.ACC_DB
slots[76] = Signal.DB_RAM
slots[77] = Signal.PC_INC
slots[78] = Signal.MC_ZERO

// DEC (Entry 80, Opcode 8): acc:=0 → ins-->ab → ram-->db → plus → acc-- → acc-->db → db-->ram → pc++ → mc:=0
slots[80] = Signal.ACC_ZERO
slots[81] = Signal.INS_AB
slots[82] = Signal.RAM_DB
slots[83] = Signal.PLUS
slots[84] = Signal.ACC_DEC
slots[85] = Signal.ACC_DB
slots[86] = Signal.DB_RAM
slots[87] = Signal.PC_INC
slots[88] = Signal.MC_ZERO

// NULL (Entry 90, Opcode 9): ins-->ab → acc:=0 → acc-->db → db-->ram → pc++ → mc:=0
// Zerstört ACC (didaktisch gewollt).
slots[90] = Signal.INS_AB
slots[91] = Signal.ACC_ZERO
slots[92] = Signal.ACC_DB
slots[93] = Signal.DB_RAM
slots[94] = Signal.PC_INC
slots[95] = Signal.MC_ZERO

// HLT (Entry 100, Opcode 10): stop → mc:=0
slots[100] = Signal.STOP
slots[101] = Signal.MC_ZERO

export const DEFAULT_MICROCODE: readonly SignalType[] = Object.freeze(slots)
