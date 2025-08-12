import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createNextRound } from '@/lib/auction'
import pusher, { triggerAuctionEvent } from '@/lib/pusher'
import { z } from 'zod'

const nextRoundSchema = z.object({
  leagueId: z.string().cuid(),
  position: z.enum(['P', 'D', 'C', 'A']),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { leagueId, position } = nextRoundSchema.parse(body)

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        admin: {
          id: session.user.id
        }
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o non autorizzato' }, { status: 404 })
    }

    // Verifica che la lega sia in stato AUCTION
    if (league.status !== 'AUCTION') {
      return NextResponse.json({ error: 'La lega non è in stato asta' }, { status: 400 })
    }

    // Crea il nuovo turno
    const newRound = await createNextRound(leagueId, position)

    // Emetti evento Pusher per notificare il nuovo turno
    await triggerAuctionEvent(leagueId, 'NEXT_ROUND_STARTED', {
      leagueId,
      round: newRound,
      position,
      message: `Nuovo turno avviato per ${position === 'P' ? 'Portieri' : position === 'D' ? 'Difensori' : position === 'C' ? 'Centrocampisti' : 'Attaccanti'}`
    })

    return NextResponse.json({
      round: newRound,
      message: `Nuovo turno avviato per ${position === 'P' ? 'Portieri' : position === 'D' ? 'Difensori' : position === 'C' ? 'Centrocampisti' : 'Attaccanti'}`
    })

  } catch (error) {
    console.error('Errore creazione turno:', error)
    
    if (error instanceof Error && error.message === 'Esiste già un turno attivo') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

// API per ottenere statistiche ruoli per aiutare l'admin a scegliere
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'LeagueId richiesto' }, { status: 400 })
    }

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        admin: {
          id: session.user.id
        }
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o non autorizzato' }, { status: 404 })
    }

    // Ottieni statistiche composizione rose
    const teams = await prisma.team.findMany({
      where: { leagueId },
      include: {
        user: {
          select: { name: true }
        },
        teamPlayers: {
          include: {
            player: {
              select: { position: true }
            }
          }
        }
      }
    })

    const maxByPosition = { P: 3, D: 8, C: 8, A: 6 }
    const teamStats = teams.map(team => {
      const composition = { P: 0, D: 0, C: 0, A: 0 }
      team.teamPlayers.forEach(tp => {
        composition[tp.player.position as keyof typeof composition]++
      })

      return {
        teamName: team.name,
        userName: team.user.name,
        composition,
        needs: {
          P: maxByPosition.P - composition.P,
          D: maxByPosition.D - composition.D,
          C: maxByPosition.C - composition.C,
          A: maxByPosition.A - composition.A,
        },
        remainingCredits: team.remainingCredits
      }
    })

    // Calcola statistiche globali
    const globalNeeds = { P: 0, D: 0, C: 0, A: 0 }
    teamStats.forEach(team => {
      globalNeeds.P += Math.max(0, team.needs.P)
      globalNeeds.D += Math.max(0, team.needs.D)
      globalNeeds.C += Math.max(0, team.needs.C)
      globalNeeds.A += Math.max(0, team.needs.A)
    })

    // Conta calciatori disponibili per ruolo
    const availablePlayers = await prisma.player.groupBy({
      by: ['position'],
      where: {
        leagueId,
        isAssigned: false
      },
      _count: {
        id: true
      }
    })

    const availableByPosition = { P: 0, D: 0, C: 0, A: 0 }
    availablePlayers.forEach(group => {
      availableByPosition[group.position as keyof typeof availableByPosition] = group._count.id
    })

    return NextResponse.json({
      teamStats,
      globalNeeds,
      availableByPosition,
      recommendations: {
        P: availableByPosition.P > 0,
        D: availableByPosition.D > 0,
        C: availableByPosition.C > 0,
        A: availableByPosition.A > 0,
      }
    })

  } catch (error) {
    console.error('Errore statistiche turno:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}