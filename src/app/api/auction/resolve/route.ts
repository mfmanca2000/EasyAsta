import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveRound } from '@/lib/auction'
import { z } from 'zod'

// Get global Socket.io instance
interface GlobalSocket {
  io?: import('socket.io').Server
}

declare const globalThis: GlobalSocket & typeof global

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

    // Get teams data needed for conflict transformation
    const allTeams = await prisma.team.findMany({
      where: { leagueId: round.league.id },
      include: {
        user: true,
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    const result = await resolveRound(roundId)
    
    // Emetti eventi Socket.io appropriati
    if (globalThis.io) {
      // Se ci sono conflitti, emetti evento per mostrare il modal
      if (result.conflicts && result.conflicts.length > 0) {
        // Transform conflicts to the format expected by ConflictResolutionModal
        const transformedConflicts = result.conflicts.map(conflict => {
          const winner = conflict.conflicts.find(c => c.isWinner);
          const winnerSelection = round.selections.find(s => 
            s.playerId === conflict.playerId && 
            allTeams.find(t => t.id === winner?.teamId)?.userId === s.userId
          );
          
          return {
            playerId: conflict.playerId,
            playerName: conflict.playerName,
            conflictedSelections: conflict.conflicts.map(conflictResult => {
              const team = allTeams.find(t => t.id === conflictResult.teamId);
              return round.selections.find(s => 
                s.playerId === conflict.playerId && 
                s.userId === team?.userId
              );
            }).filter(Boolean),
            winner: winnerSelection || null,
            randomNumbers: Object.fromEntries(
              conflict.conflicts.map(c => {
                const team = allTeams.find(t => t.id === c.teamId);
                const selection = round.selections.find(s => 
                  s.playerId === conflict.playerId && s.userId === team?.userId
                );
                return [selection?.userId || c.teamId, c.randomNumber];
              }).filter(([userId]) => userId)
            )
          };
        });

        globalThis.io.to(`auction-${round.league.id}`).emit('conflict-resolution', {
          leagueId: round.league.id,
          roundId,
          conflicts: transformedConflicts,
          roundContinues: result.roundContinues,
          assignments: result.assignments
        })
      }

      // Se il turno continua, emetti evento apposito
      if (result.roundContinues) {
        globalThis.io.to(`auction-${round.league.id}`).emit('round-continues', {
          leagueId: round.league.id,
          roundId,
          teamsWithoutAssignments: result.teamsWithoutAssignments,
          message: result.message
        })
      } else {
        // Turno completato normalmente
        globalThis.io.to(`auction-${round.league.id}`).emit('round-resolved', {
          leagueId: round.league.id,
          roundId,
          result,
          assignments: result.assignments,
          canContinue: result.canContinue
        })
      }
    }
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('Errore risoluzione turno:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

