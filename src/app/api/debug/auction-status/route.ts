import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'LeagueId richiesto' }, { status: 400 })
    }

    // Ottieni il turno corrente
    const currentRound = await prisma.auctionRound.findFirst({
      where: {
        leagueId,
        status: {
          in: ['SELECTION', 'RESOLUTION']
        }
      },
      include: {
        selections: {
          include: {
            user: { select: { id: true, name: true, isBot: true } },
            player: { select: { id: true, name: true, price: true } }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Conta le squadre nella lega
    const totalTeams = await prisma.team.count({
      where: { leagueId }
    })

    // Ottieni info sulla lega
    const league = await prisma.league.findFirst({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        status: true,
        adminId: true
      }
    })

    return NextResponse.json({
      league,
      currentRound: currentRound ? {
        id: currentRound.id,
        position: currentRound.position,
        roundNumber: currentRound.roundNumber,
        status: currentRound.status,
        selectionsCount: currentRound.selections.length,
        selections: currentRound.selections.map(s => ({
          userId: s.userId,
          userName: s.user.name,
          isBot: s.user.isBot,
          playerName: s.player.name,
          playerPrice: s.player.price
        }))
      } : null,
      totalTeams,
      isUserAdmin: session.user.id === league?.adminId,
      shouldShowResolveButton: currentRound?.status === 'RESOLUTION' && session.user.id === league?.adminId,
      debug: {
        hasCurrentRound: !!currentRound,
        allSelected: currentRound ? currentRound.selections.length === totalTeams : false,
        roundStatus: currentRound?.status,
        userId: session.user.id,
        adminId: league?.adminId
      }
    })

  } catch (error) {
    console.error('Errore debug:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}