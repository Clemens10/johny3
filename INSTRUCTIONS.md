# Phase 3 — Claude-Code-Prompt für Johny 3

> Dieser Prompt ist eigenständig und vollständig. Du brauchst keine
> weiteren Dokumente daneben — der Prompt fasst alle relevanten
> Architektur-, UI- und Backend-Entscheidungen zusammen.
>
> **Verwendung in Claude Code:**
> 1. Lege einen leeren Projektordner an
> 2. Erstelle darin eine Datei `INSTRUCTIONS.md` mit dem Inhalt unterhalb der nächsten Trennlinie
> 3. Starte Claude Code im Ordner und sage: „Lies INSTRUCTIONS.md und beginne mit Schritt 1 aus Abschnitt 11. Stelle Rückfragen bei Unklarheiten."

---

# Projekt: Johny 3 — Modernisierter Modellrechner

## 1. Hintergrund und Zielsetzung

Im Informatik-Unterricht wird der didaktische Modellrechner **Johny 2.0**
(Repository: `https://github.com/Laubersheini/johnny`, gewarteter Fork:
`https://github.com/TobisMa/johnny`) verwendet, um Schüler:innen die
Funktionsweise einer Von-Neumann-Architektur und Assembler­programmierung
nahezubringen. Das Tool hat erhebliche UX-Schwächen (umständliche
Programmeingabe, keine Labels, kein Undo im Mikrocode-Recorder,
gelegentliche Crashes) und eine etwas inkonsequente
Wert-Repräsentation (5-stellig dezimal mit verstecktem Bit-Charakter).

Diese Reimplementierung soll:

1. Ein **semantisch äquivalentes** Modell anbieten, sodass bestehende
   Aufgaben weiter funktionieren (im gültigen 16-Bit-Wertebereich).
2. Die **UX modernisieren**: Code-Editor mit Standard-Shortcuts, Labels,
   Kommentare, Inspector, klares visuelles Feedback.
3. Eine **echte Binär-Architektur** zugrunde legen (16-Bit-Wort),
   wobei die UI per Toggle Dezimal-, Binär- und Hex-Darstellung
   anbieten kann.
4. Einen **Advanced-Modus** mit modular zuschaltbaren
   Architektur-Erweiterungen bieten (Multiplikation im Akku,
   PC-Dekrement, weitere bedingte Operationen, bitweise Operationen).
5. **Optionale Accounts** mit Server-side-Persistenz und
   Geräte-Synchronisation über ein Spring-Boot-Backend mit MySQL.

**Wichtig zur Lizenz:** Das Original ist AGPL-3.0. Dieses Projekt
ist eine **Clean-Room-Reimplementierung** auf Basis der unten
dokumentierten Architektur-Spezifikation. Es darf **kein Code aus
dem Original übernommen werden**. Eigene Implementierung von Grund
auf. Lizenz dieses Projekts: MIT (vom Auftraggeber festzulegen).

## 2. Tech-Stack

### Frontend
- **Vue 3** mit Composition API (`<script setup>`)
- **Vite** als Build-Tool
- **TypeScript** im strict-mode
- **Pinia** als State Management — zentraler Simulator-Store
- **Monaco Editor** (`monaco-editor` npm-Paket) für den Assembler-Editor
- **TailwindCSS** für Styling
- **Vitest** für Unit-Tests
- **Vue Router** für Seiten­navigation (Workspaces, Login, etc.)

### Backend
- **Spring Boot 3** (Java 21)
- **Spring Web** für REST-API
- **Spring Data JPA** für Datenbankzugriff
- **Spring Security** für Auth
- **JWT** als Auth-Token (z. B. `jjwt`-Bibliothek)
- **OAuth2 Client** für Google-Login
- **MySQL 8** in Produktion, **H2** in Tests
- **JUnit 5** für Tests
- **Flyway** für DB-Migrationen

### Hosting (Zielumgebung)
- V-Server bei Hostinger oder Livingbots
- Frontend statisch ausgeliefert, Backend als JAR
- Reverse Proxy via **Caddy** (automatisches HTTPS via Let's Encrypt)
- MySQL läuft auf demselben Server

## 3. Architektur-Spezifikation des Modellrechners

### 3.1 Wortbreite und Aufteilung

Ein Maschinenwort hat **exakt 16 Bit**:

```
Bit:  15 14 13 12 | 11 10  9  8  7  6  5  4  3  2  1  0
      ┌─────────┐ ┌─────────────────────────────────────┐
      │ Opcode  │ │            Operand                  │
      │ (4 Bit) │ │           (12 Bit)                  │
      └─────────┘ └─────────────────────────────────────┘
```

- **Opcode-Bereich**: 0–15 (4 Bit)
- **Operand-Bereich**: 0–4095 (12 Bit)
- **Gesamtwort als Zahl**: 0–65535 (16 Bit)

Dezimal-Anzeige (Default): das Wort wird als `OO.OOO` ausgegeben,
wobei `OO` = Opcode zweistellig und `OOO` = Operand dreistellig.
Diese Anzeige funktioniert eindeutig nur, wenn der Operand unter
1000 bleibt — was im üblichen Nutzungs­umfang immer der Fall ist.
Bei Operanden ≥ 1000 wird in der Dezimal-Anzeige eine **vier-** oder
**fünf**-stellige Operandenzahl gezeigt (z. B. `01.4095`).

### 3.2 RAM

- **1000 Zellen** (Adressen 000–999) — kompatibel zum Original
- Im Advanced-Modus optional erweiterbar auf bis zu 4096 Zellen
  (12-Bit-Adressraum), Default bleibt 1000
- Jede Zelle enthält ein 16-Bit-Wort
- Tabelle in der UI zeigt: `Address`, `Data` (formatiert), `Asm`, `Opnd`, `Note`

### 3.3 Register

| Register | Breite | Funktion |
|---|---|---|
| Program Counter (PC) | 12 Bit | Adresse des nächsten Befehls |
| Instruction Register (IR) | 16 Bit | Aktuell ausgeführter Befehl |
| Accumulator (ACC) | 16 Bit | Einziges Rechenregister |
| Microcode Counter (MC) | 8 Bit | Position im Mikroprogramm (0–199) |

### 3.4 Steuersignale

Jeder Mikroschritt aktiviert genau ein Steuersignal. Signal-Codes:

**Classic (im Default-Modus immer verfügbar):**

| Code | Signal       | Wirkung |
|:---:|---|---|
| 0  | —             | Leerer Slot / NOP |
| 1  | `db-->ram`    | Datenbus → Speicher an aktueller AB-Adresse |
| 2  | `ram-->db`    | Speicher → Datenbus |
| 3  | `db-->ins`    | Datenbus → Instruction Register |
| 4  | `ins-->ab`    | Operand-Bits des IR → Adressbus |
| 5  | `ins-->mc`    | Opcode × 10 → MC (Decode-Sprung) |
| 6  | `=0?`         | Statusleitung ACC → PC (von `=0:pc++` gelesen) |
| 7  | `mc:=0`       | MC zurück auf 0 → nächster FETCH |
| 8  | `pc-->ab`     | Program Counter → Adressbus |
| 9  | `pc++`        | PC inkrementieren |
| 10 | `=0:pc++`     | PC inkrementieren nur wenn ACC == 0 |
| 11 | `ins-->pc`    | Operand des IR → PC (Sprung) |
| 12 | `acc:=0`      | ACC zurücksetzen |
| 13 | `plus`        | ACC := (ACC + DB) mod 2^16 |
| 14 | `minus`       | ACC := (ACC − DB) mod 2^16 |
| 15 | `acc-->db`    | ACC → Datenbus |
| 16 | `acc++`       | ACC := (ACC + 1) mod 2^16 |
| 17 | `acc--`       | ACC := (ACC − 1) mod 2^16 |
| 18 | `db-->acc`    | Datenbus → ACC |
| 19 | `stop`        | Maschine anhalten |

**Advanced (Codes 20–29 reserviert, einzeln per Toggle aktivierbar):**

| Code | Signal       | Wirkung | Toggle |
|:---:|---|---|---|
| 20 | `mul`         | ACC := (ACC × DB) mod 2^16 | F1: Multiplikation |
| 21 | `pc--`        | PC dekrementieren | F2: PC-Dekrement |
| 22 | `>0:pc++`     | PC inkrementieren wenn ACC > 0 | F3a: Größer-Null |
| 23 | `<=0:pc++`    | PC inkrementieren wenn ACC ≤ 0 | F3b: Kleiner-Gleich-Null |
| 24 | `and`         | ACC := ACC AND DB | F4: Bitweise |
| 25 | `or`          | ACC := ACC OR DB | F4: Bitweise |
| 26 | `not`         | ACC := NOT ACC (Einer­komplement) | F4: Bitweise |
| 27 | `shl`         | ACC := (ACC << 1) mod 2^16 | F4: Bitweise |
| 28 | `shr`         | ACC := ACC >> 1 | F4: Bitweise |

Arithmetik ist **modulo 2^16** (Überlauf wird stillschweigend
abgeschnitten). Es gibt **keine** negativen Zahlen.

### 3.5 Standard-Befehlssatz (immer verfügbar)

| Opcode | Mnemonic | Operand | Bedeutung |
|:---:|:---:|:---:|---|
| 01 | TAKE | adr | ACC := MEM[adr] |
| 02 | ADD  | adr | ACC := ACC + MEM[adr] |
| 03 | SUB  | adr | ACC := ACC − MEM[adr] |
| 04 | SAVE | adr | MEM[adr] := ACC |
| 05 | JMP  | adr | PC := adr |
| 06 | TST  | adr | wenn MEM[adr]==0: nächsten Befehl überspringen |
| 07 | INC  | adr | MEM[adr] := MEM[adr] + 1 |
| 08 | DEC  | adr | MEM[adr] := MEM[adr] − 1 |
| 09 | NULL | adr | MEM[adr] := 0 (zerstört ACC als Seiteneffekt) |
| 10 | HLT  | —   | Maschine anhalten |

**Didaktisch gewollte Eigenheiten — nicht "wegoptimieren":**
- Operanden sind immer Adressen, niemals Direktwerte
- `TST` zerstört den ACC
- `NULL`, `INC`, `DEC` zerstören den ACC
- `TAKE` ist als `acc:=0 + plus` implementiert, nicht als direktes Laden
- Es gibt nur eine bedingte Operation im Classic-Modus (`=0?`)

### 3.6 Mikroprogramm

- Mikrocode-Speicher: **200 Slots** (Adressen 000–199)
- Einsprung­adresse für Befehl mit Opcode N: `N × 10`
- Erreicht der MC `mc:=0`, beginnt der nächste FETCH

**FETCH (000–003):**
```
000  pc-->ab
001  ram-->db
002  db-->ins
003  ins-->mc
```

**Standard-Befehle:**
```
010 TAKE:  acc:=0   →  ins-->ab   →  ram-->db  →  plus    →  pc++   →  mc:=0
020 ADD:   ins-->ab →  ram-->db   →  plus      →  pc++    →  mc:=0
030 SUB:   ins-->ab →  ram-->db   →  minus     →  pc++    →  mc:=0
040 SAVE:  ins-->ab →  acc-->db   →  db-->ram  →  pc++    →  mc:=0
050 JMP:   ins-->pc →  mc:=0
060 TST:   ins-->ab →  ram-->db   →  db-->acc  →  =0:pc++ →  pc++   →  mc:=0
070 INC:   acc:=0   →  ins-->ab   →  ram-->db  →  plus    →  acc++  →  acc-->db →  db-->ram →  pc++ →  mc:=0
080 DEC:   acc:=0   →  ins-->ab   →  ram-->db  →  plus    →  acc--  →  acc-->db →  db-->ram →  pc++ →  mc:=0
090 NULL:  ins-->ab →  acc:=0     →  acc-->db  →  db-->ram →  pc++  →  mc:=0
100 HLT:   stop     →  mc:=0
```

### 3.7 Advanced-Befehle (Beispiele, einzeln per Toggle aktivierbar)

```
110 MUL adr:   ins-->ab → ram-->db → mul       → pc++ → mc:=0
120 LOOP adr:  ins-->ab → ram-->db → db-->acc  → pc-->ab → ram-->db → db-->ins → pc++ → <=0:pc++ → ins-->pc → mc:=0
                                                                            (mehrzeiliger Befehl)
130 TGT adr:   ins-->ab → ram-->db → db-->acc  → >0:pc++ → pc++ → mc:=0
```

LOOP belegt 2 RAM-Zellen: erste Zelle `12.zaehler`, zweite Zelle
`00.ziel`. Verhalten: wenn `MEM[zaehler] > 0`, springe zu `ziel`,
sonst weiter. (Selbst-Dekrement ist nicht eingebaut — `DEC zaehler`
muss vorher im Programm stehen.)

## 4. Mehrere Anzeige-Formate

Ein Wort kann in mehreren Formaten angezeigt werden. Das ist eine
zentrale didaktische Funktion — Schüler:innen sollen verstehen,
dass *eine* Bit-Repräsentation drei verschiedene Sichten erlaubt.

Beispiel: Wort `0000 0001 0000 0000 0101` (das entspricht „TAKE 5"):

| Format    | Anzeige |
|---|---|
| Dezimal (Default) | `01.005` |
| Binär (Advanced)  | `0001 0000 0000 0101` |
| Hex (Advanced)    | `0x1005` |
| Disassembled      | `TAKE 5` |

**Default-Modus:** zeigt nur dezimal (UI wie Original).
**Advanced-Modus:** Toggle in der RAM-Tabelle und im Inspector
schaltet zwischen den Darstellungen um. Beim **Hover über ein
Wort** erscheint ein Inspector mit allen drei Formaten gleichzeitig
samt Bit-Aufteilung in Opcode/Operand.

## 5. UI-Spezifikation

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Toolbar: [New] [Save] [Open] | [Run▶ F5] [Step F10] [µStep F11]      │
│          [Reset Shift+F5] [Speed Slider] | [Mode: Classic ▾]         │
│          [Anzeige: Dezimal ▾] | [User: anmelden ↗]                   │
├────────────────────────────────────┬─────────────────────────────────┤
│                                    │                                  │
│   Assembler-Editor (Monaco)        │   Bus-Visualisierung             │
│   ┌─────────────────────────────┐  │   (Drei Spalten:                 │
│   │ ; Multiplikation            │  │   MEMORY | CONTROL UNIT | ALU)   │
│   │ start: TAKE 101             │  │                                  │
│   │        SAVE 103             │  │   Address Bus oben (blau)        │
│   │        NULL 102             │  │   Data Bus unten (grün)          │
│   │ loop:  TST  103             │  │                                  │
│   │        JMP body             │  │                                  │
│   │ ...                         │  │                                  │
│   └─────────────────────────────┘  │                                  │
│                                    │                                  │
├────────────────────────────────────┴─────────────────────────────────┤
│ RAM-Tabelle | Mikrocode-Trace (ausklappbar) | Mikrocode-Tabelle      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Tastatur-Shortcuts

| Shortcut | Aktion |
|---|---|
| F5 | Run / Continue |
| Shift+F5 | Reset |
| F10 | Befehlsschritt |
| F11 | Mikroschritt |
| Strg+S | Speichern (Datei-Download oder Server-Save bei Account) |
| Strg+O | Datei öffnen |
| Strg+N | Neues Programm |
| Strg+Z/Y | Undo/Redo im Editor |
| Strg+/ | Kommentar im Editor toggeln |
| Strg+F/H | Suchen/Ersetzen im Editor |

### 5.3 Editor-Syntax

```asm
; Kommentare beginnen mit Semikolon
; Labels enden mit Doppelpunkt

start:  TAKE 101        ; Inline-Kommentar
        SAVE 103
        NULL 102

loop:   TST 103
        JMP body        ; Label statt Adresse
        JMP end

body:   TAKE 102
        ADD  100
        SAVE 102
        DEC  103
        JMP  loop

end:    HLT
```

Labels sind **nur Editor-Komfort** — im RAM stehen weiterhin
Adressen. Der Editor übersetzt Labels zu Adressen beim Schreiben.

### 5.4 Inspector-Hover

Bei Hover über eine Adress­referenz im Editor oder ein Wort in der
RAM-Tabelle erscheint ein Tooltip mit allen relevanten Sichten:

```
┌─────────────────────────────────────────┐
│ Adresse 100                             │
│ Wert:    01.005                         │
│ Binär:   0000 0001 0000 0000 0101       │
│ Hex:     0x1005                         │
│ Asm:     TAKE 5                         │
│ Note:    "Zähler initial"               │
│ Benutzt in Editor-Zeile: 7 (ADD)        │
└─────────────────────────────────────────┘
```

### 5.5 Mikrocode-Trace-Panel

Ausklappbare Seitenleiste, zeigt die letzten 20 Mikroschritte:

```
[T-2]  ram-->db   | DB: 00000 → 04.010
[T-1]  db-->ins   | IR: 00.000 → 04.010
[T-0]  ins-->mc   | MC: 003 → 040   ← aktuell
```

### 5.6 Ctrl-Modus (Blackbox-Schalter)

Behält die Original-Funktion bei: Checkbox blendet die gesamte
Control Unit aus (IR, PC, Mikrocode-Tabelle, Pfeile). Übrig bleibt
eine graue Blackbox mit Aufschrift „CONTROL UNIT". Dient als
Abstraktions­ebene für Lehrkräfte.

### 5.7 Modus-Badge

Oben in der Toolbar permanent sichtbar:
- "Classic" (alle Advanced-Features aus)
- "Advanced" (alle Features an)
- "Custom: N aktiv" (einzelne Features)

Klick öffnet einen Dialog mit allen Feature-Toggles.

### 5.8 Recorder mit Undo

Beim Aufnehmen neuer Mikrocode-Befehle:
- Letzten aufgenommenen Schritt entfernen (Button + Strg+Z)
- Mikrocode-Zeilen direkt editierbar (auch außerhalb des Recorders)
- Validierungs­warnung beim Speichern, wenn `mc:=0` fehlt

## 6. Datei- und Persistenz-Formate

### 6.1 Legacy-Formate (lesen UND schreiben)

**`.ram` (Original):**
- 1000 Zeilen, eine Zahl pro Zeile
- Wort ohne Punkt: `1101` statt `01.101`
- Zeilenende `\r\n`, letzte Zeile ohne abschließendes `\n`
- Leere Zellen: `0`
- **Achtung**: Original-Werte können bis 99999 gehen.
  Beim Import von Werten > 65535 wird eine Warnung angezeigt
  ("Wert wird auf 65535 begrenzt").

**`.mc` (Original):**
- 200 Zeilen Steuersignal-Codes (Zahlen 0–19)
- Danach Mnemonics-Liste, eine pro Zeile, beginnend mit `FETCH`

### 6.2 Neues Format `.johny` (JSON)

```json
{
  "format": "johny",
  "version": 1,
  "mode": "classic",
  "advancedFeatures": [],
  "ram": {
    "0":   { "value": 4357, "note": "TAKE 101 - Zähler kopieren" },
    "1":   { "value": 16487 },
    "100": { "value": 3 }
  },
  "microcode": {
    "slots": [8, 2, 3, 5, 0, 0, 0, 0, 0, 0, 12, 4, 2, 13, 9, 7, ...],
    "instructions": [
      { "opcode": 0, "mnemonic": "FETCH", "entry": 0 },
      { "opcode": 1, "mnemonic": "TAKE", "entry": 10 }
    ]
  },
  "labels": { "0": "start", "3": "loop" },
  "editorSource": "; ... Quelltext ...",
  "metadata": {
    "createdAt": "2026-05-21T...",
    "updatedAt": "...",
    "title": "Mein Workspace"
  }
}
```

## 7. Backend-Spezifikation

### 7.1 Datenmodell (MySQL-Schema)

```sql
-- Users
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                 -- NULL bei OAuth-only
  google_id VARCHAR(255) UNIQUE,              -- NULL bei E-Mail-only
  display_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

-- Workspaces (gespeicherte Stände)
CREATE TABLE workspaces (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  data JSON NOT NULL,                         -- komplettes .johny-Format
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Aufgabenvorlagen (für Lehrer, mit Permalinks)
CREATE TABLE tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  initial_state JSON NOT NULL,
  locked_addresses JSON,
  expected_state JSON,
  share_token VARCHAR(32) UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 7.2 REST-API

Alle Endpoints unter `/api/v1/`:

```
# Auth
POST   /auth/register              { email, password, displayName }
POST   /auth/login                 { email, password } → JWT
GET    /auth/google/authorize      → Redirect zu Google
GET    /auth/google/callback       → JWT
POST   /auth/logout
GET    /auth/me                    → User-Info

# Workspaces (erfordert JWT)
GET    /workspaces                 alle Workspaces des Users
POST   /workspaces                 { name, data }
GET    /workspaces/{id}
PUT    /workspaces/{id}            { name?, data? }
DELETE /workspaces/{id}

# Tasks
GET    /tasks/share/{token}        öffentlich abrufbare Aufgabe
POST   /tasks                      (eingeloggt) neue Aufgabe
GET    /tasks/mine                 (eingeloggt) eigene Aufgaben
PUT    /tasks/{id}                 (Besitzer)
DELETE /tasks/{id}                 (Besitzer)
```

JWT als `Authorization: Bearer <token>`-Header.

### 7.3 Authentifizierung

**Zwei parallele Login-Wege:**

1. **E-Mail + Passwort** (auch Wegwerf-E-Mails erlaubt, keine
   E-Mail-Verifikation als Pflicht)
   - Passwörter via BCrypt gehasht
   - Mindestpasswort: 8 Zeichen
2. **Google OAuth 2.0**
   - Client-ID/Secret per Environment-Variable konfigurierbar
   - Redirect-URI: `https://<domain>/api/v1/auth/google/callback`

Bei Login wird ein **JWT** ausgestellt (15 Min Gültigkeit) mit
**Refresh Token** (7 Tage, im httpOnly-Cookie).

### 7.4 Accounts sind optional

- Ohne Account: Frontend speichert Stände in **LocalStorage**
- Mit Account: Stände werden serverseitig synchronisiert
- **Login-Migration (Option 3)**: Beim ersten Login mit lokal
  vorhandenem Stand erscheint ein Dialog:
  ```
  ┌────────────────────────────────────────────────────┐
  │ Du hast einen lokalen Stand. Was soll passieren?   │
  │                                                    │
  │ ○ Lokalen Stand übernehmen (als "Mein Workspace")  │
  │ ○ Lokalen Stand verwerfen                          │
  │ ○ Beide behalten (lokal + Server-Workspaces)       │
  └────────────────────────────────────────────────────┘
  ```

## 8. DSGVO und Datenschutz

Da das Tool personenbezogene Daten verarbeitet (mindestens E-Mail-
Adressen), gehört zum MVP:

- **Datenschutz­erklärungs-Seite** (`/privacy`) mit Standard-Inhalten
  für eine Web-App mit Login + DB
- **Impressum-Seite** (`/imprint`) mit Platzhaltern, vom Auftraggeber
  auszufüllen
- **Cookie-Hinweis** beim ersten Besuch, falls Cookies gesetzt werden
  (für Refresh-Token-Cookie)
- **Konto-Löschung** als Funktion in den Account-Einstellungen
  (Endpoint `DELETE /api/v1/auth/me`)

Die Inhalte der Datenschutz­erklärung als Markdown-Template mitliefern;
der Auftraggeber kann sie für sein Hosting anpassen.

## 9. Projektstruktur

```
johny3/
├── README.md
├── LICENSE                              # MIT
├── docker-compose.yml                   # Lokale Entwicklung mit MySQL
├── frontend/
│   ├── src/
│   │   ├── simulator/                   # Reine Simulator-Logik
│   │   │   ├── types.ts                 # Word, Signal, Instruction
│   │   │   ├── signals.ts               # Signal-Codes, -Funktionen
│   │   │   ├── microcode.ts             # Default-Mikrocode
│   │   │   ├── simulator.ts             # step(), microstep(), reset()
│   │   │   ├── assembler.ts             # Editor-Quelltext → RAM
│   │   │   └── format.ts                # Dezimal/Binär/Hex-Konvertierung
│   │   ├── stores/
│   │   │   ├── simulator.ts             # Pinia-Store für State
│   │   │   ├── auth.ts                  # Auth-State + JWT
│   │   │   └── workspaces.ts            # Geladene Workspaces
│   │   ├── api/
│   │   │   └── client.ts                # Axios-Wrapper mit JWT
│   │   ├── components/
│   │   │   ├── EditorPane.vue
│   │   │   ├── BusVisualization.vue
│   │   │   ├── RamTable.vue
│   │   │   ├── MicrocodeTable.vue
│   │   │   ├── MicrocodeTrace.vue
│   │   │   ├── Inspector.vue
│   │   │   ├── Toolbar.vue
│   │   │   ├── ModeBadge.vue
│   │   │   ├── AuthDialog.vue
│   │   │   └── MigrationDialog.vue
│   │   ├── views/
│   │   │   ├── HomeView.vue
│   │   │   ├── LoginView.vue
│   │   │   ├── WorkspacesView.vue
│   │   │   ├── PrivacyView.vue
│   │   │   └── ImprintView.vue
│   │   ├── io/
│   │   │   ├── ramFile.ts
│   │   │   ├── mcFile.ts
│   │   │   └── johnyFile.ts
│   │   ├── router/index.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── tests/
│   │   ├── simulator/
│   │   └── fixtures/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/johny3/
│   │   │   │   ├── Johny3Application.java
│   │   │   │   ├── auth/
│   │   │   │   │   ├── AuthController.java
│   │   │   │   │   ├── JwtService.java
│   │   │   │   │   ├── GoogleOAuthService.java
│   │   │   │   │   └── SecurityConfig.java
│   │   │   │   ├── user/
│   │   │   │   │   ├── User.java
│   │   │   │   │   ├── UserRepository.java
│   │   │   │   │   └── UserService.java
│   │   │   │   ├── workspace/
│   │   │   │   │   ├── Workspace.java
│   │   │   │   │   ├── WorkspaceController.java
│   │   │   │   │   ├── WorkspaceRepository.java
│   │   │   │   │   └── WorkspaceService.java
│   │   │   │   └── task/
│   │   │   │       └── (analog)
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       ├── application-dev.yml
│   │   │       ├── application-prod.yml
│   │   │       └── db/migration/         # Flyway-Migrations
│   │   │           └── V1__init.sql
│   │   └── test/
│   ├── pom.xml
│   └── Dockerfile
└── deploy/
    ├── Caddyfile                          # Reverse Proxy + HTTPS
    └── README.md                          # Hosting-Anleitung
```

## 10. Hosting-Setup (V-Server)

In `deploy/README.md` zu dokumentieren:

1. **Voraussetzungen**: Ubuntu 22.04+ V-Server, Domain auf
   Server-IP zeigend
2. **Stack**: MySQL 8 (systemd-Service), Backend als systemd-Service
   mit JAR, Caddy als Reverse Proxy
3. **Schritte**:
   - MySQL installieren, Datenbank + User anlegen
   - Backend bauen (`mvn package`), als systemd-Service einrichten
   - Frontend bauen (`npm run build`), nach `/var/www/johny3`
   - Caddyfile mit automatischem HTTPS
4. **Google OAuth einrichten**:
   - In Google Cloud Console Projekt anlegen
   - OAuth-Credentials erstellen
   - Redirect-URI auf eigene Domain setzen
   - Client-ID/Secret in `application-prod.yml` eintragen

Beispiel-Caddyfile:
```
johny3.example.de {
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle {
        root * /var/www/johny3
        try_files {path} /index.html
        file_server
    }
}
```

## 11. Implementierungs-Reihenfolge

Bitte exakt in dieser Reihenfolge umsetzen, damit jeder Schritt
testbar ist, bevor der nächste beginnt:

### Sprint 1: Simulator-Kern (Frontend, ohne UI)
1. Projekt-Setup Frontend: Vite + Vue 3 + TS + Pinia + Vitest
2. Simulator-Typen: `Word`, `Signal`, `Instruction`, `SimulatorState`
3. RAM-Klasse mit get/set, Bounds-Checks
4. Register-Klasse mit modulo-2^16-Arithmetik
5. Signal-Implementation (Code 0–19, dann 20–28)
6. Mikroschritt-Engine + Default-Mikrocode
7. **Erster Test: Multiplikationsprogramm aus 11.x liefert 12** (siehe unten)

### Sprint 2: Frontend-UI
8. Pinia-Store, der den Simulator umschließt
9. RAM-Tabelle als erste UI-Komponente (read-only)
10. Bus-Visualisierung mit drei Spalten
11. Toolbar mit Run/Step/Reset/Speed-Slider
12. Tastatur-Shortcuts
13. Editor-Komponente mit Monaco
14. Assembler (Editor → RAM)
15. Datei-I/O: `.ram`/`.mc`/`.johny` Im- und Export

### Sprint 3: Komfort-Features
16. Inspector-Hover
17. Mikrocode-Trace-Panel
18. Mikrocode-Tabelle mit Recorder + Undo
19. Anzeige-Format-Toggle (Dezimal/Binär/Hex)
20. Modus-Badge mit Feature-Toggles
21. LocalStorage-Auto-Save

### Sprint 4: Backend
22. Spring Boot Projekt-Setup
23. User + JWT-Auth + Spring Security
24. Workspace-CRUD-Endpoints
25. Google OAuth-Flow
26. Migration-Dialog im Frontend (Option 3)
27. Datenschutz/Impressum-Seiten
28. Konto-Löschung

### Sprint 5: Deployment
29. Docker-Compose für lokale Dev-DB
30. Production-Profile mit MySQL
31. Caddyfile und systemd-Service-Files
32. Hosting-Anleitung im `deploy/README.md`

## 12. Erster Validierungs-Test

Sobald Sprint 1 fertig ist, muss dieses Programm laufen:

**Multiplikation `MEM[102] := MEM[100] × MEM[101]` (via wiederholte Addition):**

```asm
        TAKE 101        ; Zähler kopieren
        SAVE 103
        NULL 102        ; Ergebnis nullen

loop:   TST  103        ; fertig?
        JMP  body
        JMP  end

body:   TAKE 102        ; result += a
        ADD  100
        SAVE 102
        DEC  103
        JMP  loop

end:    HLT
```

Mit MEM[100] = 3, MEM[101] = 4 muss am Ende MEM[102] = 12 stehen
und MEM[101] = 4 unverändert sein.

## 13. Erfolgskriterien für MVP

### Frontend
- [ ] Multiplikations-Test grün
- [ ] Editor mit Strg+C/V/Z/F und Labels funktioniert
- [ ] Befehls- und Mikroschritt visuell unterscheidbar
- [ ] Anzeige-Toggle Dezimal/Binär/Hex
- [ ] `.ram`-Dateien aus Original-Johny werden geladen (mit Warnung
      bei Werten > 65535)
- [ ] LocalStorage-Auto-Save funktioniert
- [ ] Advanced-Modus mit mindestens `mul` und `LOOP`
- [ ] Ctrl-Modus (Blackbox) funktioniert
- [ ] Inspector zeigt alle drei Anzeige-Formate

### Backend
- [ ] User-Registrierung (E-Mail + Passwort)
- [ ] Login + JWT-Issuance
- [ ] Google OAuth funktioniert
- [ ] Workspace-CRUD funktioniert
- [ ] Konto-Löschung funktioniert (DSGVO)
- [ ] Migration-Dialog (Option 3) erscheint korrekt

### Deployment
- [ ] App ist auf einem V-Server hostbar
- [ ] HTTPS via Caddy automatisch
- [ ] Datenschutz/Impressum erreichbar

## 14. Wichtige Konventionen

- **TypeScript strict-mode** an
- **Magic Numbers** als benannte Konstanten in `simulator/types.ts`:
  ```ts
  export const WORD_BITS = 16;
  export const WORD_MAX = 65535;          // 2^16 - 1
  export const OPCODE_BITS = 4;
  export const OPCODE_MAX = 15;
  export const OPERAND_BITS = 12;
  export const OPERAND_MAX = 4095;
  export const RAM_SIZE = 1000;
  export const MICROCODE_SIZE = 200;
  export const MICROCODE_STEPS_PER_INSTRUCTION = 10;
  ```
- **Signal-Codes als TypeScript-Enum** (nicht Magic Numbers)
- **Reine Funktionen** in der Simulator-Logik (keine Side-Effects
  außerhalb des States) — erleichtert Tests und Time-Travel-Debugging
- **Commits**: Conventional Commits-Stil (`feat:`, `fix:`, `test:`)
- **Tests vor Implementation** für die Simulator-Logik

## 15. Hinweis zum Verhalten gegenüber dem User

Der Auftraggeber ist Schüler:in mit Programmierkenntnissen, aber
wenig Vue-Frontend- und Spring-Boot-Erfahrung. Bitte:

- Erkläre wichtige Designentscheidungen kurz, wenn sie über das
  hinausgehen, was im Prompt steht
- Frage bei wesentlichen Unklarheiten nach, statt zu raten
- Bevorzuge einfache, gut kommentierte Lösungen vor cleveren Tricks
- Schreibe ein hilfreiches README mit lokalem Setup-Guide

Bei Architektur-Fragen, die in diesem Dokument nicht geklärt sind,
entscheide pragmatisch und notiere die Entscheidung im README.

---

**Beginne mit Sprint 1, Schritt 1 (Frontend-Projekt-Setup).**

Lege das Projekt in der Verzeichnis­struktur aus Abschnitt 9 an
und commit jeden abgeschlossenen Schritt als eigenen Commit
(Conventional-Commits-Stil).
