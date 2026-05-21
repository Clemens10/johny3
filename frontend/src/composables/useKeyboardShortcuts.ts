import { onMounted, onUnmounted } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'

/**
 * Globale Tastaturkürzel für den Simulator (Section 5.2).
 * Wird in HomeView registriert.
 *
 * Monaco-Editor bekommt eigene Kürzel via Monaco-API (Schritt 13),
 * damit Strg+Z/Y/F/H im Editor normal funktionieren.
 */
export interface ShortcutCallbacks {
  onNew?:  () => void
  onSave?: () => void
  onOpen?: () => void
}

export function useKeyboardShortcuts(callbacks: ShortcutCallbacks = {}) {
  const store = useSimulatorStore()

  function handle(e: KeyboardEvent) {
    const ctrl  = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    // Kürzel in Eingabefeldern nicht abfangen (z. B. RAM-Inline-Editor)
    const tag = (e.target as HTMLElement).tagName
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA'

    // F-Tasten funktionieren auch in Eingabefeldern nicht — also immer abfangen
    switch (e.key) {
      case 'F5':
        e.preventDefault()
        if (shift) store.reset()
        else store.toggleRun()
        return

      case 'F10':
        e.preventDefault()
        if (!store.isRunning) store.step()
        return

      case 'F11':
        e.preventDefault()
        if (!store.isRunning) store.microstep()
        return
    }

    // Strg-Kürzel nur außerhalb von Eingabefeldern (Monaco regelt das selbst)
    if (ctrl && !inInput) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          callbacks.onNew?.()
          return
        case 's':
          e.preventDefault()
          callbacks.onSave?.()
          return
        case 'o':
          e.preventDefault()
          callbacks.onOpen?.()
          return
      }
    }
  }

  onMounted(()   => window.addEventListener('keydown', handle))
  onUnmounted(() => window.removeEventListener('keydown', handle))
}
