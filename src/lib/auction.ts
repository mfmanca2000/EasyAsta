import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function resolveRound(roundId: string) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Ottieni il turno con tutte le selezioni
    const round = await tx.auctionRound.findFirst({
      where: { id: roundId },
      include: {
        league: true,
        selections: {
          include: {
            user: true,
            player: true
          }
        }
      }
    })

    if (!round) {
      throw new Error('Turno non trovato')
    }

    // Raggruppa selezioni per calciatore
    const playerSelections = new Map<string, typeof round.selections>()
    
    round.selections.forEach(selection => {
      const playerId = selection.playerId
      if (!playerSelections.has(playerId)) {
        playerSelections.set(playerId, [])
      }
      playerSelections.get(playerId)!.push(selection)
    })

    const assignments: Array<{
      playerId: string
      winnerId: string
      winnerName: string
      playerName: string
      price: number
      randomNumber?: number
    }> = []

    // Risolvi ogni gruppo di selezioni
    for (const [, selections] of playerSelections) {
      if (selections.length === 1) {
        // Nessun conflitto - assegnazione diretta
        const selection = selections[0]
        const team = await tx.team.findFirst({
          where: {
            userId: selection.userId,
            leagueId: round.leagueId
          }
        })

        if (!team) continue

        // Verifica crediti sufficienti
        if (team.remainingCredits >= selection.player.price) {
          // Assegna calciatore
          await tx.teamPlayer.create({
            data: {
              teamId: team.id,
              playerId: selection.playerId
            }
          })

          // Scala crediti
          await tx.team.update({
            where: { id: team.id },
            data: {
              remainingCredits: team.remainingCredits - selection.player.price
            }
          })

          // Marca calciatore come assegnato
          await tx.player.update({
            where: { id: selection.playerId },
            data: { isAssigned: true }
          })

          // Marca selezione come vincente
          await tx.playerSelection.update({
            where: { id: selection.id },
            data: { isWinner: true }
          })

          assignments.push({
            playerId: selection.playerId,
            winnerId: selection.userId,
            winnerName: selection.user.name || 'Sconosciuto',
            playerName: selection.player.name,
            price: selection.player.price
          })
        }
      } else {
        // Conflitto - genera numeri casuali
        const validSelections = []
        
        for (const selection of selections) {
          const team = await tx.team.findFirst({
            where: {
              userId: selection.userId,
              leagueId: round.leagueId
            }
          })

          if (team && team.remainingCredits >= selection.player.price) {
            validSelections.push({ selection, team })
          }
        }

        if (validSelections.length > 0) {
          // Genera numeri casuali per le selezioni valide
          const randomResults = validSelections.map(({ selection, team }) => ({
            selection,
            team,
            randomNumber: Math.floor(Math.random() * 1000) + 1
          }))

          // Ordina per numero casuale (più alto vince)
          randomResults.sort((a, b) => b.randomNumber - a.randomNumber)
          const winner = randomResults[0]

          // Aggiorna tutte le selezioni con i numeri casuali
          for (const result of randomResults) {
            await tx.playerSelection.update({
              where: { id: result.selection.id },
              data: {
                randomNumber: result.randomNumber,
                isWinner: result === winner
              }
            })
          }

          // Assegna al vincitore
          await tx.teamPlayer.create({
            data: {
              teamId: winner.team.id,
              playerId: winner.selection.playerId
            }
          })

          // Scala crediti
          await tx.team.update({
            where: { id: winner.team.id },
            data: {
              remainingCredits: winner.team.remainingCredits - winner.selection.player.price
            }
          })

          // Marca calciatore come assegnato
          await tx.player.update({
            where: { id: winner.selection.playerId },
            data: { isAssigned: true }
          })

          assignments.push({
            playerId: winner.selection.playerId,
            winnerId: winner.selection.userId,
            winnerName: winner.selection.user.name || 'Sconosciuto',
            playerName: winner.selection.player.name,
            price: winner.selection.player.price,
            randomNumber: winner.randomNumber
          })
        }
      }
    }

    // Completa il turno
    await tx.auctionRound.update({
      where: { id: roundId },
      data: { status: 'COMPLETED' }
    })

    // Verifica se l'asta può continuare
    const canContinue = await checkIfAuctionCanContinue(tx, round.leagueId)

    return {
      completedRound: round,
      assignments,
      canContinue,
      message: `Turno completato! ${assignments.length} calciatori assegnati.`
    }
  })
}

async function checkIfAuctionCanContinue(tx: Prisma.TransactionClient, leagueId: string) {
  // Controlla se tutte le rose sono complete
  const teams = await tx.team.findMany({
    where: { leagueId },
    include: {
      teamPlayers: {
        include: {
          player: true
        }
      }
    }
  })

  // Definisci il numero massimo per ruolo
  const maxByPosition = { P: 3, D: 8, C: 8, A: 6 }
  
  // Controlla se tutte le squadre hanno la rosa completa
  const allRostersComplete = teams.every(team => {
    const composition = { P: 0, D: 0, C: 0, A: 0 }
    team.teamPlayers.forEach(tp => {
      composition[tp.player.position as keyof typeof composition]++
    })
    
    return composition.P === maxByPosition.P && 
           composition.D === maxByPosition.D && 
           composition.C === maxByPosition.C && 
           composition.A === maxByPosition.A
  })

  if (allRostersComplete) {
    // Asta completata
    await tx.league.update({
      where: { id: leagueId },
      data: { status: 'COMPLETED' }
    })
    return false
  }

  return true
}

// Nuova funzione per creare il prossimo turno scelto dall'admin
export async function createNextRound(leagueId: string, position: 'P' | 'D' | 'C' | 'A') {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Verifica che non ci sia già un turno attivo
    const activeRound = await tx.auctionRound.findFirst({
      where: {
        leagueId,
        status: {
          in: ['SELECTION', 'RESOLUTION']
        }
      }
    })

    if (activeRound) {
      throw new Error('Esiste già un turno attivo')
    }

    // Ottieni il numero del prossimo turno per questo ruolo
    const lastRoundForPosition = await tx.auctionRound.findFirst({
      where: {
        leagueId,
        position
      },
      orderBy: {
        roundNumber: 'desc'
      }
    })

    const nextRoundNumber = lastRoundForPosition ? lastRoundForPosition.roundNumber + 1 : 1

    // Crea il nuovo turno
    const newRound = await tx.auctionRound.create({
      data: {
        leagueId,
        position,
        roundNumber: nextRoundNumber,
        status: 'SELECTION'
      }
    })

    return newRound
  })
}