import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Get global Socket.io instance
interface GlobalSocket {
  io?: import('socket.io').Server
}

declare const globalThis: GlobalSocket & typeof global

const selectPlayerSchema = z.object({
  roundId: z.string().cuid(),
  playerId: z.string().cuid(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { roundId, playerId } = selectPlayerSchema.parse(body)

    // Verifica che il turno sia attivo
    const round = await prisma.auctionRound.findFirst({
      where: {
        id: roundId,
        status: 'SELECTION'
      },
      include: {
        league: true
      }
    })

    if (!round) {
      return NextResponse.json({ 
        error: 'Turno non trovato o non in fase di selezione' 
      }, { status: 404 })
    }

    // Verifica che l'utente faccia parte della lega
    const userTeam = await prisma.team.findFirst({
      where: {
        leagueId: round.leagueId,
        user: {
          email: session.user.email
        }
      }
    })

    if (!userTeam) {
      return NextResponse.json({ 
        error: 'Non fai parte di questa lega' 
      }, { status: 403 })
    }

    // Verifica che il calciatore sia disponibile e del ruolo giusto
    const player = await prisma.player.findFirst({
      where: {
        id: playerId,
        leagueId: round.leagueId,
        position: round.position,
        isAssigned: false
      }
    })

    if (!player) {
      return NextResponse.json({ 
        error: 'Calciatore non disponibile per questo turno' 
      }, { status: 400 })
    }

    // Verifica crediti sufficienti
    if (userTeam.remainingCredits < player.price) {
      return NextResponse.json({ 
        error: 'Crediti insufficienti per questo calciatore' 
      }, { status: 400 })
    }

    // Verifica che l'utente non abbia già selezionato in questo turno
    const existingSelection = await prisma.playerSelection.findFirst({
      where: {
        roundId,
        userId: userTeam.userId
      }
    })

    if (existingSelection) {
      return NextResponse.json({ 
        error: 'Hai già effettuato una selezione in questo turno' 
      }, { status: 400 })
    }

    // Crea la selezione e log dell'azione player
    const [selection] = await prisma.$transaction([
      // Crea la selezione
      prisma.playerSelection.create({
        data: {
          roundId,
          userId: userTeam.userId,
          playerId
        },
        include: {
          user: {
            select: { id: true, name: true }
          },
          player: true
        }
      }),
      // Log dell'azione player
      prisma.playerAction.create({
        data: {
          leagueId: round.leagueId,
          playerId: userTeam.userId,
          action: 'PLAYER_SELECT',
          targetTeamId: userTeam.id,
          targetPlayerId: playerId,
          roundId: roundId,
          metadata: {
            playerName: player.name,
            playerPosition: player.position,
            playerPrice: player.price,
            teamName: userTeam.name,
            roundNumber: round.roundNumber,
            timestamp: new Date().toISOString()
          }
        }
      })
    ])

    // Emetti evento Socket.io per notificare la selezione
    if (globalThis.io) {
      globalThis.io.to(`auction-${round.leagueId}`).emit('player-selected', {
        selection,
        leagueId: round.leagueId,
        roundId
      })
    }

    // Controlla se tutti hanno selezionato
    const allSelections = await prisma.playerSelection.findMany({
      where: { roundId }
    })

    const totalTeams = await prisma.team.count({
      where: { leagueId: round.leagueId }
    })

    if (allSelections.length === totalTeams) {
      // Tutti hanno selezionato, avvia risoluzione
      await prisma.auctionRound.update({
        where: { id: roundId },
        data: { status: 'RESOLUTION' }
      })

      // Emetti evento Socket.io per notificare che il turno è pronto per risoluzione
      if (globalThis.io) {
        globalThis.io.to(`auction-${round.leagueId}`).emit('round-ready-for-resolution', {
          leagueId: round.leagueId,
          roundId,
          message: 'Turno completato, pronto per risoluzione'
        })
      }

      return NextResponse.json({
        selection,
        roundComplete: true,
        message: 'Turno completato, risoluzione in corso...'
      })
    }

    return NextResponse.json({
      selection,
      roundComplete: false,
      waitingForOthers: true
    })

  } catch (error) {
    console.error('Errore selezione calciatore:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}