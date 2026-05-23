import { Signal, MICROCODE_SIZE } from './types'

/**
 * Reine Hilfen für den Mikrocode-Recorder (Section 5.x in INSTRUCTIONS.md).
 * Der Store hält den Aufnahme-Buffer als Reactive — die Logik hier ist pur,
 * damit sie isoliert testbar bleibt.
 */

/**
 * Hängt ein Signal an den Buffer an. Gibt einen neuen Array zurück (kein in-place).
 */
export function appendSignal(buffer: readonly Signal[], signal: Signal): Signal[] {
  return [...buffer, signal]
}

/**
 * Entfernt das zuletzt aufgenommene Signal (Undo). Bei leerem Buffer no-op.
 */
export function undoLastSignal(buffer: readonly Signal[]): Signal[] {
  return buffer.slice(0, -1)
}

/**
 * Prüft eine Aufnahme-Sequenz und gibt menschenlesbare Warnungen zurück.
 *
 * Die wichtigste Regel: eine Befehls-Sequenz muss mit `mc:=0` (Signal 7) enden,
 * sonst läuft der Simulator nach dem letzten Schritt einfach in den nächsten
 * Mikrocode-Block weiter und führt dort unbeabsichtigte Signale aus.
 */
export function validateRecording(signals: readonly Signal[]): string[] {
  const warnings: string[] = []
  if (signals.length === 0) {
    warnings.push('Sequenz ist leer — nichts aufzunehmen.')
    return warnings
  }
  if (signals[signals.length - 1] !== Signal.MC_ZERO) {
    warnings.push(
      'Sequenz endet nicht mit mc:=0 — der Simulator würde danach in den nächsten Block laufen.',
    )
  }
  return warnings
}

export interface ApplyRecordingResult {
  microcode: Signal[]
  truncated: boolean
}

/**
 * Schreibt die aufgenommene Sequenz ab `entryAddress` in den Mikrocode.
 * Wenn die Sequenz über das Ende (Adresse 199) hinausragt, wird sie
 * dort abgeschnitten und `truncated` ist true.
 */
export function applyRecording(
  microcode: readonly Signal[],
  entryAddress: number,
  signals: readonly Signal[],
): ApplyRecordingResult {
  if (!Number.isInteger(entryAddress) || entryAddress < 0 || entryAddress >= MICROCODE_SIZE) {
    throw new RangeError(
      `Einsprungadresse ${entryAddress} ist außerhalb 0..${MICROCODE_SIZE - 1}`,
    )
  }
  const result: Signal[] = [...microcode]
  let truncated = false
  for (let i = 0; i < signals.length; i++) {
    if (entryAddress + i >= MICROCODE_SIZE) {
      truncated = true
      break
    }
    result[entryAddress + i] = signals[i]
  }
  return { microcode: result, truncated }
}
