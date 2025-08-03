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
declare const global: GlobalSocket

const adminOverrideSchema = z.object({
  roundId: z.string().cuid(),
  action: z.enum(['cancel-selection', 'force-resolution', 'reset-round']),
  targetTeamId: z.string().cuid().optional(),
  reason: z.string().min(5, 'La motivazione deve essere di almeno 5 caratteri'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { roundId, action, targetTeamId, reason } = adminOverrideSchema.parse(body)

    // Verifica che il turno esista
    const round = await prisma.auctionRound.findFirst({
      where: {
        id: roundId
      },
      include: {
        league: {
          include: {
            admin: true
          }
        },
        selections: {
          include: {
            user: {
              select: { id: true, name: true }
            },
            player: true
          }
        }
      }
    })

    if (!round) {
      return NextResponse.json({ 
        error: 'Turno non trovato' 
      }, { status: 404 })
    }

    // Verifica che l'utente sia admin della lega
    if (round.league.admin.email !== session.user.email) {
      return NextResponse.json({ 
        error: 'Solo l\'admin può effettuare override' 
      }, { status: 403 })
    }

    let result: { action: string; message: string; cancelledPlayer?: string } = { action: '', message: '' }

    switch (action) {
      case 'cancel-selection':
        if (!targetTeamId) {
          return NextResponse.json({ 
            error: 'targetTeamId richiesto per annullare selezione' 
          }, { status: 400 })
        }

        // Trova la squadra target
        const targetTeam = await prisma.team.findFirst({
          where: {
            id: targetTeamId,
            leagueId: round.leagueId
          },
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        })

        if (!targetTeam) {
          return NextResponse.json({ 
            error: 'Squadra target non trovata' 
          }, { status: 404 })
        }

        // Trova e rimuovi la selezione
        const selectionToCancel = await prisma.playerSelection.findFirst({
          where: {
            roundId,
            userId: targetTeam.userId
          },
          include: {
            player: true
          }
        })

        if (!selectionToCancel) {
          return NextResponse.json({ 
            error: `${targetTeam.name} non ha effettuato alcuna selezione in questo turno` 
          }, { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
          // Rimuovi la selezione
          await tx.playerSelection.delete({
            where: { id: selectionToCancel.id }
          })

          // Log dell'azione admin
          await tx.adminAction.create({
            data: {
              leagueId: round.leagueId,
              adminId: session.user!.id!,
              action: 'CANCEL_SELECTION',
              targetTeamId: targetTeamId,
              playerId: selectionToCancel.playerId,
              roundId: roundId,
              reason,
              metadata: {
                targetTeamName: targetTeam.name,
                cancelledPlayerName: selectionToCancel.player.name,
                cancelledPlayerPrice: selectionToCancel.player.price
              }
            }
          })
        })

        result = {
          action: 'selection-cancelled',
          message: `Selezione di ${targetTeam.name} annullata con successo`,
          cancelledPlayer: selectionToCancel.player.name
        }
        break

      case 'force-resolution':
        if (round.status !== 'SELECTION') {
          return NextResponse.json({ 
            error: 'Il turno non è in fase di selezione' 
          }, { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
          // Cambia stato turno
          await tx.auctionRound.update({
            where: { id: roundId },
            data: { status: 'RESOLUTION' }
          })

          // Log dell'azione admin
          await tx.adminAction.create({
            data: {
              leagueId: round.leagueId,
              adminId: session.user!.id!,
              action: 'FORCE_RESOLUTION',
              roundId: roundId,
              reason,
              metadata: {
                selectionsCount: round.selections.length,
                forcedResolution: true
              }
            }
          })
        })

        result = {
          action: 'resolution-forced',
          message: 'Risoluzione turno forzata con successo'
        }
        break

      case 'reset-round':
        await prisma.$transaction(async (tx) => {
          // Trova il turno precedente per reimpostarlo come COMPLETED
          const previousRound = await tx.auctionRound.findFirst({
            where: {
              leagueId: round.leagueId,
              roundNumber: round.roundNumber - 1
            }
          })

          // Log dell'azione admin PRIMA di eliminare il turno
          await tx.adminAction.create({
            data: {
              leagueId: round.leagueId,
              adminId: session.user!.id!,
              action: 'RESET_ROUND',
              roundId: roundId,
              reason,
              metadata: {
                deletedSelectionsCount: round.selections.length,
                deletedRound: true,
                roundNumber: round.roundNumber,
                position: round.position,
                previousRoundRestored: !!previousRound,
                previousRoundId: previousRound?.id
              }
            }
          })

          // Rimuovi tutte le selezioni del turno corrente
          await tx.playerSelection.deleteMany({
            where: { roundId }
          })

          // Elimina completamente il turno corrente
          await tx.auctionRound.delete({
            where: { id: roundId }
          })

          // Se esiste un turno precedente, reimpostalo come COMPLETED
          if (previousRound) {
            await tx.auctionRound.update({
              where: { id: previousRound.id },
              data: { status: 'COMPLETED' }
            })
          }
        })

        result = {
          action: 'round-reset',
          message: `Turno ${round.roundNumber} (${round.position}) eliminato completamente. ${round.selections.length} selezioni rimosse. Ritorno alla scelta del ruolo.`
        }
        break
    }

    // Emetti evento Socket.io per notificare l'override admin
    const io = globalThis.io || global.io
    if (io) {
      io.to(`auction-${round.leagueId}`).emit('admin-override', {
        leagueId: round.leagueId,
        roundId,
        action,
        result,
        reason,
        adminName: session.user.name || session.user.email
      })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Errore override admin:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dati richiesta non validi', 
        details: error.issues 
      }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}