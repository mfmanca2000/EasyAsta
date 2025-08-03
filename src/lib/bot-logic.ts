import { prisma } from '@/lib/prisma'

export interface BotSelectionResult {
  playerId: string
  reason: string
  confidence: number // 0-100
}

interface Player {
  id: string
  name: string
  position: 'P' | 'D' | 'C' | 'A'
  realTeam: string
  price: number
  isAssigned: boolean
}

interface TeamWithPlayers {
  id: string
  remainingCredits: number
  teamPlayers: Array<{
    player: Player
  }>
}

interface PositionNeeds {
  P: number
  D: number
  C: number
  A: number
}

// Logica selezione intelligente per bot
export async function calculateBotSelection(
  userId: string,
  leagueId: string,
  roundId: string,
  intelligence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
): Promise<BotSelectionResult | null> {
  try {
    // Ottieni informazioni del turno corrente
    const round = await prisma.auctionRound.findFirst({
      where: { id: roundId },
      include: {
        league: true,
        selections: true
      }
    })

    if (!round) return null

    // Ottieni squadra del bot
    const team = await prisma.team.findFirst({
      where: { userId, leagueId },
      include: {
        teamPlayers: {
          include: {
            player: true
          }
        }
      }
    })

    if (!team) return null

    // Ottieni calciatori disponibili per il ruolo corrente
    const availablePlayers = await prisma.player.findMany({
      where: {
        leagueId,
        position: round.position,
        isAssigned: false,
        price: { lte: team.remainingCredits }
      },
      orderBy: { price: 'desc' }
    })

    if (availablePlayers.length === 0) return null

    // Calcola composizione attuale rosa
    const currentComposition = { P: 0, D: 0, C: 0, A: 0 }
    team.teamPlayers.forEach(tp => {
      currentComposition[tp.player.position as keyof typeof currentComposition]++
    })

    const maxByPosition = { P: 3, D: 8, C: 8, A: 6 }
    const neededByPosition = {
      P: maxByPosition.P - currentComposition.P,
      D: maxByPosition.D - currentComposition.D,
      C: maxByPosition.C - currentComposition.C,
      A: maxByPosition.A - currentComposition.A
    }

    // Filtra calciatori già selezionati in questo turno
    const alreadySelected = round.selections.map(s => s.playerId)
    const selectablePlayers = availablePlayers.filter(p => !alreadySelected.includes(p.id))

    if (selectablePlayers.length === 0) return null

    // Selezione basata su intelligenza
    switch (intelligence) {
      case 'LOW':
        return selectRandomPlayer(selectablePlayers)
      
      case 'MEDIUM':
        return selectBalancedPlayer(selectablePlayers, team, neededByPosition, round.position)
      
      case 'HIGH':
        return selectOptimalPlayer(selectablePlayers, team, neededByPosition, round.position, leagueId)
      
      default:
        return selectBalancedPlayer(selectablePlayers, team, neededByPosition, round.position)
    }
  } catch (error) {
    console.error('Errore selezione bot:', error)
    return null
  }
}

// Selezione casuale (LOW intelligence)
function selectRandomPlayer(players: Player[]): BotSelectionResult {
  const randomPlayer = players[Math.floor(Math.random() * players.length)]
  return {
    playerId: randomPlayer.id,
    reason: 'Selezione casuale',
    confidence: 30
  }
}

// Selezione equilibrata prezzo/necessità (MEDIUM intelligence)
function selectBalancedPlayer(
  players: Player[],
  team: TeamWithPlayers,
  needed: PositionNeeds,
  position: keyof PositionNeeds
): BotSelectionResult {
  const neededForPosition = needed[position as keyof typeof needed]
  const totalCreditsRemaining = team.remainingCredits
  
  // Se serve solo 1 calciatore per questo ruolo, prendi uno medio-alto
  if (neededForPosition === 1) {
    const midHighPlayers = players.filter(p => p.price >= totalCreditsRemaining * 0.3)
    if (midHighPlayers.length > 0) {
      const selected = midHighPlayers[Math.floor(Math.random() * midHighPlayers.length)]
      return {
        playerId: selected.id,
        reason: `Ultimo ${position} necessario - investimento importante`,
        confidence: 75
      }
    }
  }

  // Calcola budget ideale per ruolo
  const totalNeeded = Object.values(needed).reduce((sum: number, val: number) => sum + val, 0)
  const averageBudgetPerPlayer = totalCreditsRemaining / Math.max(totalNeeded, 1)
  
  // Filtra calciatori nel range budget ±50%
  const budgetMin = averageBudgetPerPlayer * 0.5
  const budgetMax = averageBudgetPerPlayer * 1.5
  
  const budgetPlayers = players.filter(p => p.price >= budgetMin && p.price <= budgetMax)
  
  if (budgetPlayers.length > 0) {
    // Preferisci qualità leggermente superiore
    budgetPlayers.sort((a, b) => b.price - a.price)
    const selected = budgetPlayers[Math.floor(Math.random() * Math.min(3, budgetPlayers.length))]
    
    return {
      playerId: selected.id,
      reason: `Selezione equilibrata - budget €${averageBudgetPerPlayer.toFixed(0)} per giocatore`,
      confidence: 65
    }
  }

  // Fallback: prendi un giocatore accessibile
  const affordable = players.filter(p => p.price <= totalCreditsRemaining * 0.8)
  if (affordable.length > 0) {
    const selected = affordable[Math.floor(Math.random() * affordable.length)]
    return {
      playerId: selected.id,
      reason: 'Selezione conservativa per preservare crediti',
      confidence: 50
    }
  }

  // Ultima risorsa
  return selectRandomPlayer(players)
}

// Selezione ottimizzata strategica (HIGH intelligence)
async function selectOptimalPlayer(
  players: Player[],
  team: TeamWithPlayers,
  needed: PositionNeeds,
  position: keyof PositionNeeds,
  leagueId: string
): Promise<BotSelectionResult> {
  try {
    // Analizza concorrenza: vedi altri team e loro crediti
    const allTeams = await prisma.team.findMany({
      where: { leagueId },
      include: {
        teamPlayers: {
          include: {
            player: true
          }
        }
      }
    })

    const competitors = allTeams.filter(t => t.id !== team.id)
    const avgCompetitorCredits = competitors.reduce((sum, t) => sum + t.remainingCredits, 0) / competitors.length

    // Strategia aggressiva se abbiamo più crediti della media
    const isRichTeam = team.remainingCredits > avgCompetitorCredits * 1.2
    
    // Strategia conservativa se abbiamo meno crediti
    const isPoorTeam = team.remainingCredits < avgCompetitorCredits * 0.8

    const neededForPosition = needed[position as keyof typeof needed]
    const totalNeeded = Object.values(needed).reduce((sum: number, val: number) => sum + val, 0)

    if (isRichTeam && neededForPosition <= 2) {
      // Team ricco + pochi slot rimasti = investi su qualità
      const topPlayers = players.slice(0, Math.min(5, players.length))
      const selected = topPlayers[Math.floor(Math.random() * topPlayers.length)]
      
      return {
        playerId: selected.id,
        reason: `Strategia aggressiva - crediti superiori media (€${avgCompetitorCredits.toFixed(0)})`,
        confidence: 85
      }
    }

    if (isPoorTeam || totalNeeded > 10) {
      // Team povero o molti slot = strategia conservativa
      const budgetPerPlayer = team.remainingCredits / Math.max(totalNeeded, 1)
      const conservativePlayers = players.filter(p => p.price <= budgetPerPlayer * 1.1)
      
      if (conservativePlayers.length > 0) {
        // Prendi il migliore nel budget conservativo
        conservativePlayers.sort((a, b) => b.price - a.price)
        const selected = conservativePlayers[0]
        
        return {
          playerId: selected.id,
          reason: `Strategia conservativa - ${totalNeeded} slot rimasti`,
          confidence: 80
        }
      }
    }

    // Strategia equilibrata standard
    return selectBalancedPlayer(players, team, needed, position)
    
  } catch (error) {
    console.error('Errore selezione ottimale:', error)
    return selectBalancedPlayer(players, team, needed, position)
  }
}

// Crea utenti bot per una lega
export async function createBotUsers(leagueId: string, count: number = 3): Promise<string[]> {
  const botUserIds: string[] = []
  
  for (let i = 1; i <= count; i++) {
    const botUser = await prisma.user.create({
      data: {
        email: `bot${i}@easyasta.local`,
        name: `🤖 Bot ${i}`,
        role: 'PLAYER',
        isBot: true
      }
    })

    // Crea team per il bot
    await prisma.team.create({
      data: {
        name: `Squadra Bot ${i}`,
        userId: botUser.id,
        leagueId: leagueId,
        remainingCredits: 500 // Default credits
      }
    })

    botUserIds.push(botUser.id)
  }

  return botUserIds
}

// Rimuovi bot da una lega
export async function removeBotUsers(leagueId: string): Promise<void> {
  // Trova tutti i bot nella lega
  const botTeams = await prisma.team.findMany({
    where: { leagueId },
    include: { user: true }
  })

  const botUserIds = botTeams
    .filter(team => team.user.isBot)
    .map(team => team.user.id)

  if (botUserIds.length > 0) {
    // Rimuovi teams (cascade eliminerà teamPlayers)
    await prisma.team.deleteMany({
      where: {
        leagueId,
        userId: { in: botUserIds }
      }
    })

    // Rimuovi selezioni bot
    await prisma.playerSelection.deleteMany({
      where: {
        userId: { in: botUserIds }
      }
    })

    // Rimuovi utenti bot
    await prisma.user.deleteMany({
      where: {
        id: { in: botUserIds },
        isBot: true
      }
    })
  }
}