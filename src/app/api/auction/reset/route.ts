import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const resetSchema = z.object({
  leagueId: z.string().cuid(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { leagueId } = resetSchema.parse(body)

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

    // Get counts before reset for audit log
    const [selectionsCount, roundsCount, teamPlayersCount, teamsCount] = await Promise.all([
      prisma.playerSelection.count({
        where: {
          round: {
            leagueId
          }
        }
      }),
      prisma.auctionRound.count({
        where: { leagueId }
      }),
      prisma.teamPlayer.count({
        where: {
          team: {
            leagueId
          }
        }
      }),
      prisma.team.count({
        where: { leagueId }
      })
    ])

    // Reset completo dell'asta in una transazione
    await prisma.$transaction(async (tx) => {
      // Log dell'azione admin PRIMA del reset
      await tx.adminAction.create({
        data: {
          leagueId,
          adminId: session.user.id!,
          action: 'EMERGENCY_PAUSE', // Using EMERGENCY_PAUSE as closest enum value
          reason: 'Reset completo dell\'asta - eliminazione di tutti i dati',
          metadata: {
            resetType: 'COMPLETE_AUCTION_RESET',
            deletedSelections: selectionsCount,
            deletedRounds: roundsCount,
            deletedTeamPlayers: teamPlayersCount,
            resetTeams: teamsCount,
            resetCredits: league.credits,
            leagueStatusBefore: league.status,
            timestamp: new Date().toISOString()
          }
        }
      })

      // 1. Elimina tutte le selezioni
      await tx.playerSelection.deleteMany({
        where: {
          round: {
            leagueId
          }
        }
      })

      // 2. Elimina tutti i turni
      await tx.auctionRound.deleteMany({
        where: { leagueId }
      })

      // 3. Rimuovi tutti i calciatori dalle squadre
      await tx.teamPlayer.deleteMany({
        where: {
          team: {
            leagueId
          }
        }
      })

      // 4. Resetta i crediti delle squadre
      await tx.team.updateMany({
        where: { leagueId },
        data: { remainingCredits: league.credits }
      })

      // 5. Marca tutti i calciatori come non assegnati
      await tx.player.updateMany({
        where: { leagueId },
        data: { isAssigned: false }
      })

      // 6. Resetta lo stato della lega a SETUP
      await tx.league.update({
        where: { id: leagueId },
        data: { status: 'SETUP' }
      })

      // 7. Resetta configurazione asta se esiste (ma NON eliminiamo AdminAction per mantenere audit trail)
      await tx.auctionConfig.deleteMany({
        where: { leagueId }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Asta resettata con successo'
    })

  } catch (error) {
    console.error('Errore reset asta:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}