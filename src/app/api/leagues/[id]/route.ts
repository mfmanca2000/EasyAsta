import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const resolvedParams = await params
    const leagueId = resolvedParams.id

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Trova la lega e verifica che l'utente abbia accesso
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        OR: [
          { adminId: user.id },
          { teams: { some: { userId: user.id } } }
        ]
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        teams: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            teamPlayers: {
              include: {
                player: {
                  select: {
                    id: true,
                    name: true,
                    position: true,
                    realTeam: true,
                    price: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        _count: {
          select: {
            teams: true,
            players: true
          }
        }
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o accesso negato' }, { status: 404 })
    }

    return NextResponse.json({ league })
    
  } catch (error) {
    console.error('Errore recupero lega:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}