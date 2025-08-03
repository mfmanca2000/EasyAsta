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

const adminSelectSchema = z.object({
  roundId: z.string().cuid(),
  playerId: z.string().cuid(),
  targetTeamId: z.string().cuid(),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { roundId, playerId, targetTeamId, reason } = adminSelectSchema.parse(body)

    // Verifica che il turno sia attivo
    const round = await prisma.auctionRound.findFirst({
      where: {
        id: roundId,
        status: 'SELECTION'
      },
      include: {
        league: {
          include: {
            admin: true
          }
        }
      }
    })

    if (!round) {
      return NextResponse.json({ 
        error: 'Turno non trovato o non in fase di selezione' 
      }, { status: 404 })
    }

    // Verifica che l'utente sia admin della lega
    if (round.league.admin.email !== session.user.email) {
      return NextResponse.json({ 
        error: 'Solo l\'admin può effettuare selezioni per conto di altre squadre' 
      }, { status: 403 })
    }

    // Verifica che la squadra target esista e faccia parte della lega
    const targetTeam = await prisma.team.findFirst({
      where: {
        id: targetTeamId,
        leagueId: round.leagueId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!targetTeam) {
      return NextResponse.json({ 
        error: 'Squadra target non trovata o non parte di questa lega' 
      }, { status: 404 })
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

    // Verifica crediti sufficienti per la squadra target
    if (targetTeam.remainingCredits < player.price) {
      return NextResponse.json({ 
        error: `Crediti insufficienti per ${targetTeam.name}. Disponibili: ${targetTeam.remainingCredits}, Necessari: ${player.price}` 
      }, { status: 400 })
    }

    // Verifica che la squadra target non abbia già selezionato in questo turno
    const existingSelection = await prisma.playerSelection.findFirst({
      where: {
        roundId,
        userId: targetTeam.userId
      }
    })

    if (existingSelection) {
      return NextResponse.json({ 
        error: `${targetTeam.name} ha già effettuato una selezione in questo turno` 
      }, { status: 400 })
    }

    // Transazione per creare la selezione admin e log dell'azione
    const result = await prisma.$transaction(async (tx) => {
      // Crea la selezione per conto della squadra target
      const selection = await tx.playerSelection.create({
        data: {
          roundId,
          userId: targetTeam.userId,
          playerId,
          isAdminSelection: true,
          adminReason: reason || 'Selezione effettuata dall\'admin'
        },
        include: {
          user: {
            select: { id: true, name: true }
          },
          player: true
        }
      })

      // Log dell'azione admin
      await tx.adminAction.create({
        data: {
          leagueId: round.leagueId,
          adminId: session.user!.id!,
          action: 'ADMIN_SELECT',
          targetTeamId: targetTeamId,
          playerId: playerId,
          roundId: roundId,
          reason: reason || 'Selezione per conto della squadra',
          metadata: {
            targetTeamName: targetTeam.name,
            targetUserName: targetTeam.user.name,
            playerName: player.name,
            playerPrice: player.price
          }
        }
      })

      return selection
    })

    // Emetti evento Socket.io per notificare la selezione admin
    if (globalThis.io) {
      globalThis.io.to(`auction-${round.leagueId}`).emit('admin-player-selected', {
        selection: result,
        leagueId: round.leagueId,
        roundId,
        isAdminAction: true,
        adminReason: reason || 'Selezione effettuata dall\'admin',
        targetTeam: {
          id: targetTeam.id,
          name: targetTeam.name,
          userName: targetTeam.user.name
        }
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
          message: 'Turno completato con selezione admin, pronto per risoluzione'
        })
      }

      return NextResponse.json({
        selection: result,
        roundComplete: true,
        message: 'Selezione admin completata, turno pronto per risoluzione'
      })
    }

    return NextResponse.json({
      selection: result,
      roundComplete: false,
      message: `Selezione effettuata per ${targetTeam.name}. In attesa delle altre squadre.`
    })

  } catch (error) {
    console.error('Errore selezione admin:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dati richiesta non validi', 
        details: error.issues 
      }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}