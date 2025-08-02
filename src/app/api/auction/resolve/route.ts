import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRound } from '@/lib/auction'
import { z } from 'zod'

const resolveRoundSchema = z.object({
  roundId: z.string().cuid(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { roundId } = resolveRoundSchema.parse(body)

    // Verifica che il turno sia in risoluzione
    const round = await prisma.auctionRound.findFirst({
      where: {
        id: roundId,
        status: 'RESOLUTION'
      },
      include: {
        league: {
          include: {
            admin: true
          }
        },
        selections: {
          include: {
            user: true,
            player: true
          }
        }
      }
    })

    if (!round) {
      return NextResponse.json({ 
        error: 'Turno non trovato o non in risoluzione' 
      }, { status: 404 })
    }

    // Solo l'admin può triggare manualmente la risoluzione
    if (round.league.admin.email !== session.user.email) {
      return NextResponse.json({ 
        error: 'Solo l\'admin può risolvere i turni' 
      }, { status: 403 })
    }

    const result = await resolveRound(roundId)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Errore risoluzione turno:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

