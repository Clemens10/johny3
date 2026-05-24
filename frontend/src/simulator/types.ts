// Wortbreite und Bereichsgrenzen (Section 3.1 / Section 14)
export const WORD_BITS = 16;
export const WORD_MAX = 65535;           // 2^16 - 1
export const OPCODE_BITS = 4;
export const OPCODE_MAX = 15;
export const OPERAND_BITS = 12;
export const OPERAND_MAX = 4095;
export const RAM_SIZE = 1000;
export const MICROCODE_SIZE = 200;
export const MICROCODE_STEPS_PER_INSTRUCTION = 10;

/** Ein 16-Bit-Maschinenwort (0–65535). */
export type Word = number;

/** 4-Bit Opcode (0–15). */
export type Opcode = number;

/** 12-Bit Operand (0–4095). */
export type Operand = number;

/** Ein dekodiertes Maschinenwort. */
export interface Instruction {
  opcode: Opcode;
  operand: Operand;
}

// TypeScript 6 / erasableSyntaxOnly: enum durch const-Objekt + Typ ersetzen

/** Steuersignal-Codes (Section 3.4). */
export const Signal = {
  NOP:       0,
  DB_RAM:    1,   // db-->ram
  RAM_DB:    2,   // ram-->db
  DB_INS:    3,   // db-->ins
  INS_AB:    4,   // ins-->ab
  INS_MC:    5,   // ins-->mc  (Decode: opcode * 10 → MC)
  ZERO_TEST: 6,   // =0?
  MC_ZERO:   7,   // mc:=0
  PC_AB:     8,   // pc-->ab
  PC_INC:    9,   // pc++
  ZERO_SKIP: 10,  // =0:pc++
  INS_PC:    11,  // ins-->pc
  ACC_ZERO:  12,  // acc:=0
  PLUS:      13,  // ACC := (ACC + DB) mod 2^16
  MINUS:     14,  // ACC := (ACC − DB) mod 2^16
  ACC_DB:    15,  // acc-->db
  ACC_INC:   16,  // acc++
  ACC_DEC:   17,  // acc--
  DB_ACC:    18,  // db-->acc
  STOP:      19,  // stop
  // Advanced (Codes 20–28)
  MUL:       20,  // ACC := (ACC × DB) mod 2^16   [F1]
  PC_DEC:    21,  // pc--                          [F2]
  GT_SKIP:   22,  // >0:pc++                       [F3]
  // 23 frei (war <=0:pc++, redundant zu =0:pc++ da es keine negativen Zahlen gibt)
  AND:       24,  // ACC := ACC AND DB             [F4]
  OR:        25,  // ACC := ACC OR DB              [F4]
  NOT:       26,  // ACC := NOT ACC                [F4]
  SHL:       27,  // ACC := (ACC << 1) mod 2^16    [F4]
  SHR:       28,  // ACC := ACC >> 1               [F4]
} as const;
export type Signal = (typeof Signal)[keyof typeof Signal];

/** Advanced-Feature-Toggles. */
export const AdvancedFeature = {
  F1_MUL:     'F1_MUL',
  F2_PC_DEC:  'F2_PC_DEC',
  F3A_GT:     'F3A_GT',
  F4_BITWISE: 'F4_BITWISE',
} as const;
export type AdvancedFeature = (typeof AdvancedFeature)[keyof typeof AdvancedFeature];

/** Vollständiger Simulator-Zustand (unveränderlich behandeln außerhalb des Stores). */
export interface SimulatorState {
  ram: Word[];             // 1000 (oder bis 4096) Zellen
  microcode: Signal[];     // 200 Slots
  pc: number;              // 12 Bit (0–4095)
  ir: Word;                // 16 Bit
  acc: Word;               // 16 Bit
  mc: number;              // 8 Bit (0–199)
  dataBus: Word;           // aktueller DB-Wert (für Visualisierung)
  addressBus: number;      // aktueller AB-Wert
  halted: boolean;
  activeFeatures: Set<AdvancedFeature>;
}
