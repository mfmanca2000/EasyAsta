# EasyAsta - Applicazione Aste Fantacalcio

## Panoramica Progetto

**Nome**: EasyAsta  
**Tipo**: Applicazione web per gestione aste fantacalcio  
**Tecnologie**: Next.js 15, TypeScript, Prisma, PostgreSQL, NextAuth.js, Socket.io  
**Creato**: 2025-08-01  
**Stato**: Progettazione iniziale  

### Descrizione
Applicazione web che permette di gestire aste del fantacalcio con sistema di turni, selezioni simultanee e risoluzione conflitti tramite numeri casuali. Supporta da 4 a 8 squadre per lega, con autenticazione Google e aggiornamenti real-time.

### Funzionalità Principali
- Creazione leghe fantacalcio (4-8 squadre)
- Import calciatori da file Excel
- Sistema aste a turni per ruolo (P/D/C/A)
- Selezione simultanea con risoluzione conflitti
- Gestione crediti e assegnazione automatica
- Dashboard real-time per giocatori e admin
- Correzione manuale rose per admin

### Composizione Rosa
- 3 Portieri (P)
- 8 Difensori (D)  
- 8 Centrocampisti (C)
- 6 Attaccanti (A)

## Stack Tecnologico

### Core
- **Framework**: Next.js 15 (App Router)
- **Linguaggio**: TypeScript
- **Database**: PostgreSQL con Prisma ORM
- **Autenticazione**: NextAuth.js (Google OAuth)
- **Real-time**: Socket.io
- **Styling**: Tailwind CSS + Shadcn/ui

### Dipendenze Aggiuntive
- **xlsx**: Import file Excel
- **zod**: Validazione dati
- **react-hook-form**: Gestione form
- **lucide-react**: Icone
- **next-intl**: Internazionalizzazione

## Schema Database

### Modelli Principali

```prisma
// User - Utenti dell'applicazione
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  role          UserRole  @default(PLAYER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relazioni
  adminLeagues  League[]  @relation("LeagueAdmin")
  teams         Team[]
  selections    PlayerSelection[]
}

// League - Leghe fantacalcio
model League {
  id          String      @id @default(cuid())
  name        String
  adminId     String
  credits     Int         @default(500)
  status      LeagueStatus @default(SETUP)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  // Relazioni
  admin       User        @relation("LeagueAdmin", fields: [adminId], references: [id])
  teams       Team[]
  players     Player[]
  rounds      AuctionRound[]
}

// Team - Squadre dei giocatori
model Team {
  id              String    @id @default(cuid())
  name            String
  userId          String    
  leagueId        String
  remainingCredits Int
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relazioni
  user            User      @relation(fields: [userId], references: [id])
  league          League    @relation(fields: [leagueId], references: [id])
  teamPlayers     TeamPlayer[]
  
  @@unique([userId, leagueId])
}

// Player - Calciatori disponibili
model Player {
  id          String      @id @default(cuid())
  name        String
  position    Position
  realTeam    String
  price       Int
  leagueId    String
  isAssigned  Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  // Relazioni
  league      League      @relation(fields: [leagueId], references: [id])
  teamPlayers TeamPlayer[]
  selections  PlayerSelection[]
}

// TeamPlayer - Calciatori assegnati alle squadre
model TeamPlayer {
  id          String    @id @default(cuid())
  teamId      String
  playerId    String
  acquiredAt  DateTime  @default(now())
  
  // Relazioni
  team        Team      @relation(fields: [teamId], references: [id])
  player      Player    @relation(fields: [playerId], references: [id])
  
  @@unique([teamId, playerId])
}

// AuctionRound - Turni d'asta
model AuctionRound {
  id          String      @id @default(cuid())
  leagueId    String
  position    Position
  roundNumber Int
  status      RoundStatus @default(SELECTION)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  // Relazioni
  league      League      @relation(fields: [leagueId], references: [id])
  selections  PlayerSelection[]
}

// PlayerSelection - Selezioni dei giocatori
model PlayerSelection {
  id            String    @id @default(cuid())
  roundId       String
  userId        String
  playerId      String
  randomNumber  Int?
  isWinner      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  
  // Relazioni
  round         AuctionRound @relation(fields: [roundId], references: [id])
  user          User      @relation(fields: [userId], references: [id])
  player        Player    @relation(fields: [playerId], references: [id])
  
  @@unique([roundId, userId])
}

// Enums
enum UserRole {
  PLAYER
  ADMIN
}

enum LeagueStatus {
  SETUP
  AUCTION
  COMPLETED
}

enum Position {
  P  // Portiere
  D  // Difensore
  C  // Centrocampista
  A  // Attaccante
}

enum RoundStatus {
  SELECTION
  RESOLUTION
  COMPLETED
}
```

## Struttura Directory

```
EasyAsta/
├── CLAUDE.md                 # Questo file
├── package.json              # Dipendenze e script
├── next.config.js            # Configurazione Next.js
├── tailwind.config.js        # Configurazione Tailwind
├── prisma/
│   ├── schema.prisma         # Schema database
│   └── migrations/           # Migrazioni database
├── src/
│   ├── app/                  # App Router Next.js 15
│   │   ├── layout.tsx        # Layout principale
│   │   ├── page.tsx          # Homepage
│   │   ├── auth/             # Pagine autenticazione
│   │   ├── dashboard/        # Dashboard giocatore
│   │   ├── admin/            # Dashboard admin
│   │   └── api/              # API routes
│   │       ├── auth/         # NextAuth endpoints
│   │       ├── leagues/      # API leghe
│   │       ├── players/      # API calciatori
│   │       └── auction/      # API asta
│   │           ├── route.ts       # Avvio asta e stato
│   │           ├── select/        # Selezione calciatori
│   │           ├── resolve/       # Risoluzione turni
│   │           └── next-round/    # Creazione turno successivo
│   ├── components/           # Componenti riutilizzabili
│   │   ├── ui/               # Componenti Shadcn/ui
│   │   ├── auth/             # Componenti autenticazione
│   │   ├── league/           # Componenti lega
│   │   ├── player/           # Componenti calciatori
│   │   └── auction/          # Componenti asta
│   ├── lib/                  # Utility e configurazioni
│   │   ├── prisma.ts         # Client Prisma
│   │   ├── auth.ts           # Configurazione NextAuth
│   │   ├── auction.ts        # Logica core asta
│   │   ├── socket.ts         # Configurazione Socket.io
│   │   └── utils.ts          # Utility generiche
│   ├── hooks/                # Custom hooks
│   ├── types/                # Definizioni TypeScript
│   └── styles/               # File CSS
└── public/                   # Asset statici
```

## Piano di Sviluppo

### Fase 1: Setup Iniziale (1-2 giorni)
- [x] Creare CLAUDE.md progetto
- [x] Inizializzare progetto Next.js 15 con TypeScript
- [x] Configurare Prisma con PostgreSQL
- [x] Setup NextAuth.js per Google OAuth
- [x] Installare dipendenze (Tailwind, Shadcn/ui, Socket.io, xlsx)
- [x] Configurare environment variables

### Fase 2: Database e Autenticazione (1 giorno)
- [x] Implementare schema Prisma completo
- [x] Creare migrazioni database
- [x] Configurare NextAuth.js con Google Provider
- [x] Implementare middleware protezione route
- [x] Test connessione database

### Fase 3: UI Base e Layout (1-2 giorni)
- [x] Setup Shadcn/ui e Tailwind
- [x] Creare layout base con navigazione
- [x] Implementare componenti UI riutilizzabili
- [x] Pagina login/logout
- [x] Dashboard base per utenti

### Fase 4: Internazionalizzazione (1 giorno) ✅ COMPLETATA
- [x] Configurare next-intl per supporto multilingue
- [x] Creare file di traduzione completi (IT/FR)
- [x] Implementare sistema traduzioni con useTranslations
- [x] Tradurre tutte le stringhe UI e messaggi di errore
- [x] Localizzazione di 325+ stringhe per lingua
- [x] Test e correzione dependency arrays React Hook

### Fase 5: Gestione Leghe e Squadre (2 giorni)
- [x] API e UI creazione leghe
- [x] Sistema partecipazione a leghe
- [x] Gestione squadre (4-8 per lega)
- [x] Visualizzazione rose con composizione
- [x] Validazione regole composizione rosa

### Fase 6: Import e Gestione Calciatori (1 giorno)
- [x] Upload file Excel
- [x] Parser dati calciatori (Nome, Squadra, P/D/C/A, Prezzo)
- [x] Validazione e import in database
- [x] CRUD calciatori per admin
- [x] Lista calciatori con filtri

### Fase 7: Sistema Asta Core (3-4 giorni)
- [x] Logica creazione turni per ruolo
- [x] Sistema selezione simultanea calciatori
- [x] Generazione numeri casuali per conflitti
- [x] Algoritmo assegnazione automatica
- [x] Scalamento crediti squadre
- [x] Gestione stati asta

### Fase 8: Real-time e Socket.io (2 giorni)
- [ ] Configurazione server Socket.io
- [ ] Real-time updates selezioni
- [ ] Notifiche assegnazioni
- [ ] Sincronizzazione stati asta
- [ ] Gestione disconnessioni

### Fase 9: Funzionalità Admin (1-2 giorni)
- [ ] Pannello controllo asta
- [ ] Avvio turni e selezione ruoli
- [ ] Correzione manuale rose
- [ ] Configurazione crediti lega
- [ ] Override assegnazioni

### Fase 10: Testing e Ottimizzazioni (1-2 giorni)
- [ ] Test funzionalità complete
- [ ] Test performance real-time
- [ ] Ottimizzazioni database
- [ ] Gestione errori
- [ ] Test responsive design

### Fase 11: Deploy (1 giorno)
- [ ] Configurazione ambiente produzione
- [ ] Deploy database PostgreSQL
- [ ] Deploy su Vercel/Railway
- [ ] Test ambiente produzione
- [ ] Documentazione deploy

## Todo List Corrente

### Priorità Alta
- [ ] Inizializzare progetto Next.js 15
- [ ] Configurare database PostgreSQL
- [ ] Implementare autenticazione Google

### Priorità Media
- [ ] Setup UI components
- [ ] Implementare logica asta
- [ ] Configurare Socket.io

### Priorità Bassa
- [ ] Ottimizzazioni performance
- [ ] Test end-to-end
- [ ] Deploy produzione

## Comandi Utili

```bash
# Installazione dipendenze
npm install

# Avvio sviluppo
npm run dev

# Build produzione
npm run build

# Database
npx prisma migrate dev
npx prisma generate
npx prisma studio

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check
```

## Note Tecniche

### Decisioni Architetturali
- **Next.js 15 App Router**: Per migliori performance e developer experience
- **Prisma + PostgreSQL**: Per relazioni complesse e transazioni ACID
- **Socket.io**: Per real-time senza polling
- **NextAuth.js**: Per autenticazione sicura e semplice
- **Shadcn/ui**: Per componenti consistenti e accessibili

### Flusso Asta (Aggiornato)
1. Admin avvia l'asta (primo turno Portieri automatico)
2. Tutti i giocatori vedono calciatori disponibili per il ruolo corrente
3. Ogni giocatore seleziona un calciatore
4. Quando tutti hanno selezionato, sistema passa in RESOLUTION
5. Admin risolve il turno manualmente o automaticamente
6. Sistema genera numeri casuali per conflitti
7. Calciatori assegnati al numero più alto, crediti scalati
8. **NOVITÀ**: Admin sceglie il ruolo per il prossimo turno tramite modal
9. Modal mostra statistiche e raccomandazioni per ogni ruolo
10. Admin seleziona ruolo e si ripete il processo
11. Asta completata quando tutte le rose sono al completo (3P/8D/8C/6A)

### Validazioni Importanti
- Rosa deve avere esattamente 3P, 8D, 8C, 6A
- Crediti non possono andare in negativo
- Solo admin può avviare turni
- File Excel deve avere formato corretto
- Ruoli devono essere solo P, D, C, A

### Miglioramenti Implementati
- ✅ **Flessibilità Turni**: Admin può scegliere qualsiasi ruolo per il turno successivo
- ✅ **Statistiche Smart**: Modal con dati dettagliati per aiutare l'admin nella scelta
- ✅ **Gestione Locale**: Redirect dinamici basati su locale corrente
- ✅ **Validazione Robusta**: Controlli crediti, stato lega, duplicati
- ✅ **Transazioni Database**: Operazioni atomiche per consistency
- ✅ **Internazionalizzazione Completa**: Supporto multilingue IT/FR con next-intl

### Problemi da Risolvere
- Sostituire polling con Socket.io per real-time
- Timeout per selezioni troppo lente
- Backup/restore stato asta
- Ottimizzazione query database con molti calciatori
- Gestione disconnessioni durante selezione

## Stato Attuale

**Data ultimo aggiornamento**: 2025-08-03  
**Fase corrente**: Fasi 1-8 completate + Internazionalizzazione  
**Prossimo step**: Iniziare Fase 9 - Funzionalità Admin Avanzate  

### Completato
- [x] **Fase 1**: Setup Iniziale
  - [x] Definizione requisiti funzionali
  - [x] Design architettura sistema
  - [x] Schema database completo
  - [x] Piano sviluppo dettagliato
  - [x] Creazione CLAUDE.md
  - [x] Inizializzazione progetto Next.js 15
  - [x] Configurazione Prisma completa
  - [x] Setup NextAuth.js base
  - [x] Installazione dipendenze core

- [x] **Fase 2**: Database e Autenticazione
  - [x] Migrazioni database create e applicate
  - [x] Test connessione database
  - [x] Configurazione NextAuth.js con Google OAuth
  - [x] Middleware protezione route

- [x] **Fase 3**: UI Base e Layout
  - [x] Setup Shadcn/ui e Tailwind CSS
  - [x] Layout base con navigazione
  - [x] Componenti UI riutilizzabili (Button, Card, Input)
  - [x] Pagina home con autenticazione
  - [x] Dashboard base per utenti
  - [x] Sistema di routing protetto

- [x] **Fase 5**: Gestione Leghe e Squadre
  - [x] API creazione leghe (POST /api/leagues)
  - [x] API partecipazione leghe (POST /api/leagues/join)
  - [x] API dettagli lega (GET /api/leagues/[id])
  - [x] UI form creazione e partecipazione leghe
  - [x] Sistema gestione squadre (4-8 per lega)
  - [x] Validazione composizione rosa (3P/8D/8C/6A)
  - [x] Visualizzatore rose con filtri
  - [x] Navigazione "Leghe" in navbar

- [x] **Fase 6**: Import e Gestione Calciatori
  - [x] Upload file Excel con validazione formato
  - [x] Parser calciatori Excel (Nome, Squadra, P/D/C/A, Prezzo)
  - [x] Validazione e import database con transazioni
  - [x] API CRUD completa calciatori (GET, POST, PUT, DELETE)
  - [x] Lista calciatori con filtri avanzati (ricerca, ruolo, stato)
  - [x] Paginazione e ordinamento dinamico
  - [x] Interfaccia gestione calciatori per admin
  - [x] Funzionalità eliminazione calciatori

- [x] **Fase 7**: Sistema Asta Core
  - [x] API sistema asta (/api/auction, /api/auction/select, /api/auction/resolve)
  - [x] Logica creazione turni per ruolo (P/D/C/A)
  - [x] Sistema selezione simultanea calciatori
  - [x] Generazione numeri casuali per conflitti automatici
  - [x] Algoritmo assegnazione automatica con transazioni
  - [x] Scalamento crediti squadre
  - [x] Gestione stati asta (SETUP → AUCTION → COMPLETED)
  - [x] Pagina asta completa con interfaccia admin e giocatori
  - [x] Sistema flessibile di scelta ruolo da parte admin
  - [x] Modal statistiche per selezione prossimo ruolo
  - [x] Polling real-time per aggiornamenti (temporaneo)

- [x] **Fase 4**: Internazionalizzazione (Completata)
  - [x] Configurazione next-intl per supporto multilingue
  - [x] Creazione file di traduzione completi (IT/FR)
  - [x] Traduzione di tutte le stringhe UI in italiano e francese
  - [x] Sistema di switching lingua funzionante
  - [x] Localizzazione messaggi di errore e notifiche
  - [x] 325+ traduzioni per entrambe le lingue
  - [x] Sostituzione di tutte le stringhe hardcoded con chiavi di traduzione
  - [x] Gestione corretta delle dipendenze React Hook per le traduzioni

- [x] **Fase 8**: Real-time e Socket.io (Completata)
  - [x] Configurazione server Socket.io con Next.js 15
  - [x] Custom server per gestire Socket.io
  - [x] Integrazione eventi Socket.io nelle API routes
  - [x] Hook useSocketIO per gestione connessioni client
  - [x] Hook useAuctionRealtime per stato asta real-time
  - [x] Sostituzione completa del polling con Socket.io
  - [x] Sistema notifiche toast per eventi real-time
  - [x] Gestione heartbeat e riconnessioni automatiche
  - [x] Tracciamento utenti connessi e disconnessioni
  - [x] Fallback polling quando Socket.io non disponibile
  - [x] Indicatori visual stato connessione real-time

### In Corso
- [ ] **Fase 9**: Funzionalità Admin Avanzate

### Da Fare
- Funzionalità Admin avanzate (Fase 9)
- Testing e Ottimizzazioni (Fase 10)
- Deploy (Fase 11)

---

**Nota**: Questo file viene aggiornato ad ogni sessione di sviluppo per mantenere traccia dei progressi e delle decisioni tecniche.