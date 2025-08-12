import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateBotSelection } from '@/lib/bot-logic'
import pusher, { triggerAuctionEvent } from '@/lib/pusher'

// POST - Esegui selezione automatica per bot
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body = await request.json()
    const { leagueId, roundId, botUserId } = body

    if (!leagueId || !roundId) {
      return NextResponse.json({ error: 'Parametri richiesti mancanti' }, { status: 400 })
    }

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        adminId: session.user.id
      },
      include: {
        botConfig: true
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o accesso negato' }, { status: 404 })
    }

    if (!league.botConfig?.isEnabled) {
      return NextResponse.json({ error: 'Modalità test bot non abilitata' }, { status: 400 })
    }

    // Ottieni il turno corrente
    const round = await prisma.auctionRound.findFirst({
      where: { id: roundId, leagueId },
      include: {
        selections: true
      }
    })

    if (!round || round.status !== 'SELECTION') {
      return NextResponse.json({ error: 'Turno non trovato o non in fase di selezione' }, { status: 400 })
    }

    // Se botUserId specificato, seleziona per quello specifico
    if (botUserId) {
      const botUser = await prisma.user.findFirst({
        where: { id: botUserId, isBot: true }
      })

      if (!botUser) {
        return NextResponse.json({ error: 'Bot non trovato' }, { status: 404 })
      }

      // Verifica che il bot non abbia già selezionato
      const existingSelection = await prisma.playerSelection.findFirst({
        where: { roundId, userId: botUserId }
      })

      if (existingSelection) {
        return NextResponse.json({ error: 'Bot ha già effettuato una selezione' }, { status: 400 })
      }

      const selection = await calculateBotSelection(
        botUserId, 
        leagueId, 
        roundId, 
        league.botConfig.intelligence
      )

      if (!selection) {
        return NextResponse.json({ error: 'Nessun calciatore disponibile per il bot' }, { status: 400 })
      }

      // Esegui la selezione e log audit in transazione
      const selectionRecord = await prisma.$transaction(async (tx) => {
        const selectionRecord = await tx.playerSelection.create({
          data: {
            roundId,
            userId: botUserId,
            playerId: selection.playerId,
            isAdminSelection: true,
            adminReason: `Selezione automatica bot: ${selection.reason}`
          },
          include: {
            user: {
              select: { id: true, name: true }  
            },
            player: true
          }
        })

        // Log dell'azione admin per selezione bot
        await tx.adminAction.create({
          data: {
            leagueId,
            adminId: session.user.id!,
            action: 'ADMIN_SELECT',
            targetTeamId: (await tx.team.findFirst({ where: { userId: botUserId, leagueId } }))?.id,
            playerId: selection.playerId,
            roundId,
            reason: `Selezione bot automatica: ${selection.reason}`,
            metadata: {
              isBot: true,
              botName: botUser.name,
              selectionReason: selection.reason,
              confidence: selection.confidence,
              playerName: selectionRecord.player.name,
              playerPrice: selectionRecord.player.price
            }
          }
        })

        return selectionRecord
      })

      // Emetti evento Pusher per notificare la selezione del bot
      await triggerAuctionEvent(leagueId, 'PLAYER_SELECTED', {
        selection: {
          id: selectionRecord.id,
          user: selectionRecord.user,
          player: selectionRecord.player
        },
        leagueId,
        roundId,
        isBot: true
      })

      // Controlla se tutti hanno selezionato
      const allSelections = await prisma.playerSelection.findMany({
        where: { roundId }
      })

      const totalTeams = await prisma.team.count({
        where: { leagueId }
      })

      if (allSelections.length === totalTeams) {
        // Tutti hanno selezionato, avvia risoluzione
        await prisma.auctionRound.update({
          where: { id: roundId },
          data: { status: 'RESOLUTION' }
        })

        // Emetti evento Pusher per notificare che il turno è pronto per risoluzione
        await triggerAuctionEvent(leagueId, 'ROUND_READY_FOR_RESOLUTION', {
          leagueId,
          roundId,
          message: 'Turno completato, pronto per risoluzione'
        })
      }

      return NextResponse.json({
        success: true,
        botName: botUser.name,
        playerSelected: selection.playerId,
        reason: selection.reason,
        confidence: selection.confidence,
        roundComplete: allSelections.length === totalTeams
      })
    }

    // Altrimenti, fai selezionare tutti i bot che non hanno ancora selezionato
    const botTeams = await prisma.team.findMany({
      where: {
        leagueId,
        user: { isBot: true }
      },
      include: {
        user: true
      }
    })

    const results = []

    for (const team of botTeams) {
      // Verifica che il bot non abbia già selezionato
      const existingSelection = await prisma.playerSelection.findFirst({
        where: { roundId, userId: team.userId }
      })

      if (existingSelection) continue

      // Simula delay di selezione
      const delay = Math.random() * 
        (league.botConfig.selectionDelayMax - league.botConfig.selectionDelayMin) + 
        league.botConfig.selectionDelayMin

      // In un ambiente reale, useresti setTimeout, ma per l'API restituiamo subito
      const selection = await calculateBotSelection(
        team.userId, 
        leagueId, 
        roundId, 
        league.botConfig.intelligence
      )

      if (selection) {
        const selectionRecord = await prisma.$transaction(async (tx) => {
          const selectionRecord = await tx.playerSelection.create({
            data: {
              roundId,
              userId: team.userId,
              playerId: selection.playerId,
              isAdminSelection: true,
              adminReason: `Selezione automatica bot: ${selection.reason}`
            },
            include: {
              user: {
                select: { id: true, name: true }
              },
              player: true
            }
          })

          // Log dell'azione admin per selezione bot
          await tx.adminAction.create({
            data: {
              leagueId,
              adminId: session.user.id!,
              action: 'ADMIN_SELECT',
              targetTeamId: team.id,
              playerId: selection.playerId,
              roundId,
              reason: `Selezione bot automatica: ${selection.reason}`,
              metadata: {
                isBot: true,
                botName: team.user.name,
                selectionReason: selection.reason,
                confidence: selection.confidence,
                playerName: selectionRecord.player.name,
                playerPrice: selectionRecord.player.price,
                simulatedDelay: delay.toFixed(1)
              }
            }
          })

          return selectionRecord
        })

        // Emetti evento Pusher per ogni selezione bot
        await triggerAuctionEvent(leagueId, 'PLAYER_SELECTED', {
          selection: {
            id: selectionRecord.id,
            user: selectionRecord.user,
            player: selectionRecord.player
          },
          leagueId,
          roundId,
          isBot: true
        })

        results.push({
          botName: team.user.name,
          playerSelected: selection.playerId,
          reason: selection.reason,
          confidence: selection.confidence,
          simulatedDelay: delay.toFixed(1)
        })
      }
    }

    // Controlla se tutti hanno selezionato dopo le selezioni dei bot
    const allSelections = await prisma.playerSelection.findMany({
      where: { roundId }
    })

    const totalTeams = await prisma.team.count({
      where: { leagueId }
    })

    let roundComplete = false
    if (allSelections.length === totalTeams) {
      // Tutti hanno selezionato, avvia risoluzione
      await prisma.auctionRound.update({
        where: { id: roundId },
        data: { status: 'RESOLUTION' }
      })

      // Emetti evento Pusher per notificare che il turno è pronto per risoluzione
      await triggerAuctionEvent(leagueId, 'ROUND_READY_FOR_RESOLUTION', {
        leagueId,
        roundId,
        message: 'Turno completato, pronto per risoluzione'
      })
      roundComplete = true
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} bot hanno effettuato le loro selezioni`,
      selections: results,
      roundComplete,
      totalSelections: allSelections.length,
      totalTeams
    })

  } catch (error) {
    console.error('Errore selezione bot:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}

// GET - Ottieni stato selezioni bot per un turno
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const roundId = searchParams.get('roundId')

    if (!leagueId || !roundId) {
      return NextResponse.json({ error: 'Parametri richiesti mancanti' }, { status: 400 })
    }

    // Verifica accesso alla lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        OR: [
          { adminId: session.user.id },
          { teams: { some: { userId: session.user.id } } }
        ]
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o accesso negato' }, { status: 404 })
    }

    // Ottieni bot nella lega
    const botTeams = await prisma.team.findMany({
      where: {
        leagueId,
        user: { isBot: true }
      },
      include: {
        user: true
      }
    })

    // Ottieni selezioni bot per questo turno
    const botSelections = await prisma.playerSelection.findMany({
      where: {
        roundId,
        userId: { in: botTeams.map(bt => bt.userId) }
      },
      include: {
        user: true,
        player: true
      }
    })

    const botStatus = botTeams.map(team => {
      const selection = botSelections.find(s => s.userId === team.userId)
      return {
        botId: team.userId,
        botName: team.user.name,
        hasSelected: !!selection,
        selectedPlayer: selection ? {
          id: selection.player.id,
          name: selection.player.name,
          price: selection.player.price,
          reason: selection.adminReason
        } : null
      }
    })

    return NextResponse.json({
      totalBots: botTeams.length,
      botsSelected: botSelections.length,
      botStatus
    })

  } catch (error) {
    console.error('Errore GET stato bot:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}