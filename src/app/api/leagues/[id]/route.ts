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

export async function DELETE(
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

    // Verifica che la lega esista e che l'utente sia l'admin
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        adminId: user.id // Solo l'admin può eliminare la lega
      }
    })

    if (!league) {
      return NextResponse.json({ 
        error: 'Lega non trovata o non hai i permessi per eliminarla' 
      }, { status: 404 })
    }

    // Elimina tutti i dati correlati alla lega in una transazione
    await prisma.$transaction(async (tx) => {
      // 1. Elimina tutte le azioni admin correlate
      await tx.adminAction.deleteMany({
        where: { leagueId }
      });

      // 2. Elimina tutte le azioni player correlate
      await tx.playerAction.deleteMany({
        where: { leagueId }
      });

      // 3. Elimina tutte le selezioni dei calciatori nei turni d'asta
      const rounds = await tx.auctionRound.findMany({
        where: { leagueId },
        select: { id: true }
      });
      
      if (rounds.length > 0) {
        await tx.playerSelection.deleteMany({
          where: {
            roundId: { in: rounds.map(r => r.id) }
          }
        });
      }

      // 4. Elimina tutti i turni d'asta
      await tx.auctionRound.deleteMany({
        where: { leagueId }
      });

      // 5. Elimina tutte le associazioni squadra-calciatore
      const teams = await tx.team.findMany({
        where: { leagueId },
        select: { id: true }
      });
      
      if (teams.length > 0) {
        await tx.teamPlayer.deleteMany({
          where: {
            teamId: { in: teams.map(t => t.id) }
          }
        });
      }

      // 6. Elimina tutte le squadre
      await tx.team.deleteMany({
        where: { leagueId }
      });

      // 7. Elimina tutti i calciatori
      await tx.player.deleteMany({
        where: { leagueId }
      });

      // 8. Elimina la configurazione dell'asta
      await tx.auctionConfig.deleteMany({
        where: { leagueId }
      });

      // 9. Elimina la configurazione bot
      await tx.botConfig.deleteMany({
        where: { leagueId }
      });

      // 10. Infine, elimina la lega
      await tx.league.delete({
        where: { id: leagueId }
      });
    });

    return NextResponse.json({ 
      message: 'Lega eliminata con successo' 
    })
    
  } catch (error) {
    console.error('Errore eliminazione lega:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}