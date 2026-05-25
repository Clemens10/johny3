# Johny 3 — Frontend

Moderne Reimplementierung des Johnny-Modellrechners (Vue 3 + TypeScript + Vite).

Der Simulator ist eine clean-room-Implementierung; siehe `../INSTRUCTIONS.md`
für die Architektur (16-Bit-Wörter, 4-Bit-Opcodes, Mikrocode-Speicher
mit 200 Slots, Classic/Advanced-Modus).

## Entwicklung

```bash
npm install          # einmalig
npm run dev          # Dev-Server auf http://localhost:5173
npm test             # Vitest (53 Tests)
npm run build        # TypeScript-Check + Produktions-Build
```

`npm run build` (vue-tsc) prüft strenger als `npm test` — vor jedem Commit
laufen lassen, nicht nur die Tests.

## Unterstützte Bildschirmgrößen

Das UI ist als Desktop-Tool gedacht; die drei Hauptbereiche (Editor,
Bus-Visualisierung mit klickbaren Toren, RAM-/Mikrocode-Tabelle) brauchen
nebeneinander Platz.

| Breite           | Bewertung                                                        |
|------------------|------------------------------------------------------------------|
| **≥ 1920 px**    | Empfohlen — alles angenehm lesbar, Trace-Panel kann ausgeklappt sitzen. |
| **≥ 1280 px**    | Mindestbreite für die regelmäßige Nutzung — alle Tore sichtbar. |
| **1024–1279 px** | Eingeschränkt nutzbar — gelber Hinweisbalken oben. Operations-Chips wrappen mehrzeilig, Werte werden truncated, falls nötig. |
| **< 1024 px**    | Nicht empfohlen — Layout kann unleserlich werden. Tablets/Smartphones werden nicht unterstützt. |

Unter 1280 px Breite zeigt das UI einen gelben Hinweisbalken oben.

## Projektstruktur

```
src/
  simulator/   # Simulator-Kern (pure TypeScript, ohne Vue)
  stores/      # Pinia-Store (simulator.ts)
  components/  # Vue-Komponenten (BusVisualization, RamTable, …)
  composables/ # Wiederverwendbare Vue-Logik
  views/       # Routen-Views (HomeView)
tests/         # Vitest-Suiten
```
