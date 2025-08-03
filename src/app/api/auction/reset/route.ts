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

    // Reset completo dell'asta in una transazione
    await prisma.$transaction(async (tx) => {
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

      // 7. Elimina eventuali azioni admin
      await tx.adminAction.deleteMany({
        where: { leagueId }
      })

      // 8. Resetta configurazione asta se esiste
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