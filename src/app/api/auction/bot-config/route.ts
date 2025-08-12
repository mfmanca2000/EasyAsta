import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createBotUsers, removeBotUsers } from '@/lib/bot-logic'
import { triggerLeaguesEvent } from '@/lib/pusher'

// GET - Ottieni configurazione bot per lega
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'ID lega richiesto' }, { status: 400 })
    }

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        adminId: session.user.id
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o accesso negato' }, { status: 404 })
    }

    // Ottieni configurazione bot
    const botConfig = await prisma.botConfig.findFirst({
      where: { leagueId }
    })

    // Conta bot attivi nella lega
    const botCount = await prisma.team.count({
      where: {
        leagueId,
        user: { isBot: true }
      }
    })

    return NextResponse.json({
      config: botConfig || {
        isEnabled: false,
        selectionDelayMin: 2,
        selectionDelayMax: 8,
        intelligence: 'MEDIUM'
      },
      activeBots: botCount
    })

  } catch (error) {
    console.error('Errore GET bot config:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}

// POST - Configura/abilita bot per lega
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      leagueId, 
      isEnabled, 
      botCount = 3,
      selectionDelayMin = 2,
      selectionDelayMax = 8,
      intelligence = 'MEDIUM'
    } = body

    if (!leagueId) {
      return NextResponse.json({ error: 'ID lega richiesto' }, { status: 400 })
    }

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        adminId: session.user.id
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o accesso negato' }, { status: 404 })
    }

    // Verifica che la lega sia in fase SETUP
    if (league.status !== 'SETUP') {
      return NextResponse.json({ 
        error: 'I bot possono essere configurati solo durante il setup della lega' 
      }, { status: 400 })
    }

    // Get current bot count before changes
    const currentBotCount = await prisma.team.count({
      where: {
        leagueId,
        user: { isBot: true }
      }
    })

    // Handle bot users outside transaction first
    if (isEnabled) {
      // Rimuovi eventuali bot esistenti
      await removeBotUsers(leagueId)
      
      // Crea nuovi bot
      const botUserIds = await createBotUsers(leagueId, botCount)
      
      // Aggiorna crediti bot basandosi sui crediti della lega
      await prisma.team.updateMany({
        where: {
          leagueId,
          userId: { in: botUserIds }
        },
        data: {
          remainingCredits: league.credits
        }
      })
    } else {
      // Disabilita bot - rimuovi tutti
      await removeBotUsers(leagueId)
    }

    // Then handle configuration and audit in a quick transaction
    await prisma.$transaction(async (tx) => {
      // Upsert configurazione bot
      await tx.botConfig.upsert({
        where: { leagueId },
        update: {
          isEnabled,
          selectionDelayMin,
          selectionDelayMax,
          intelligence
        },
        create: {
          leagueId,
          isEnabled,
          selectionDelayMin,
          selectionDelayMax,
          intelligence
        }
      })

      // Log dell'azione admin
      await tx.adminAction.create({
        data: {
          leagueId,
          adminId: session.user.id!,
          action: 'TIMEOUT_CONFIG', // Using closest enum value
          reason: isEnabled ? 'Bot abilitati per modalità test' : 'Bot disabilitati',
          metadata: {
            actionType: 'BOT_CONFIG_UPDATE',
            isEnabled,
            botCount: isEnabled ? botCount : 0,
            previousBotCount: currentBotCount,
            selectionDelayMin,
            selectionDelayMax,
            intelligence,
            timestamp: new Date().toISOString()
          }
        }
      })
    })

    const finalBotCount = await prisma.team.count({
      where: {
        leagueId,
        user: { isBot: true }
      }
    })

    // Get updated league info for socket emission
    const updatedLeague = await prisma.league.findFirst({
      where: { id: leagueId },
      include: {
        _count: { select: { teams: true } }
      }
    })

    // Emit Socket.io events to notify users about bot changes
    if (updatedLeague) {
      if (isEnabled && finalBotCount > 0) {
        // Get actual bot teams to emit proper names
        const botTeams = await prisma.team.findMany({
          where: {
            leagueId,
            user: { isBot: true }
          },
          include: {
            user: true
          }
        })

        // Emit Pusher events for each bot when enabling bot configuration
        if (botTeams && botTeams.length > 0) {
          botTeams.forEach(async (botTeam) => {
            await triggerLeaguesEvent('TEAM_JOINED', {
              leagueId: leagueId,
              teamName: botTeam.name,
              userName: botTeam.user.name || 'Bot AI',
              teamCount: updatedLeague._count.teams
            });
          });
        }
        
        // Always emit a general league update event for any configuration change
        await triggerLeaguesEvent('LEAGUE_UPDATED', {
          leagueId: leagueId,
          teamCount: updatedLeague._count.teams
        });
        
        // Emit specific bot configuration update event
        await triggerLeaguesEvent('BOT_CONFIG_UPDATED', {
          leagueId: leagueId,
          isEnabled: isEnabled,
          botCount: finalBotCount,
          intelligence: intelligence
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: isEnabled 
        ? `Modalità test abilitata con ${finalBotCount} bot`
        : 'Modalità test disabilitata',
      activeBots: finalBotCount
    })

  } catch (error) {
    console.error('Errore POST bot config:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}

// DELETE - Rimuovi tutti i bot dalla lega
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'ID lega richiesto' }, { status: 400 })
    }

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        adminId: session.user.id
      }
    })

    if (!league) {
      return NextResponse.json({ error: 'Lega non trovata o accesso negato' }, { status: 404 })
    }

    // Get current bot count for audit log
    const currentBotCount = await prisma.team.count({
      where: {
        leagueId,
        user: { isBot: true }
      }
    })

    // Remove bot users first (outside transaction)
    await removeBotUsers(leagueId)

    // Then handle configuration and audit in a quick transaction
    await prisma.$transaction(async (tx) => {
      // Disabilita configurazione bot
      await tx.botConfig.upsert({
        where: { leagueId },
        update: { isEnabled: false },
        create: { leagueId, isEnabled: false }
      })

      // Log dell'azione admin
      await tx.adminAction.create({
        data: {
          leagueId,
          adminId: session.user.id!,
          action: 'TIMEOUT_CONFIG', // Using closest enum value
          reason: 'Tutti i bot rimossi dalla lega',
          metadata: {
            actionType: 'BOT_REMOVAL',
            removedBotCount: currentBotCount,
            isEnabled: false,
            timestamp: new Date().toISOString()
          }
        }
      })
    })

    // Get updated league info for socket emission
    const updatedLeague = await prisma.league.findFirst({
      where: { id: leagueId },
      include: {
        _count: { select: { teams: true } }
      }
    })

    // Emit Pusher events to notify users about bot removal
    if (updatedLeague) {
      await triggerLeaguesEvent('LEAGUE_UPDATED', {
        leagueId: leagueId,
        teamCount: updatedLeague._count.teams
      });
      
      // Emit specific bot configuration update event
      await triggerLeaguesEvent('BOT_CONFIG_UPDATED', {
        leagueId: leagueId,
        isEnabled: false,
        botCount: 0,
        intelligence: 'MEDIUM' // Default since bots are disabled
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Tutti i bot sono stati rimossi dalla lega'
    })

  } catch (error) {
    console.error('Errore DELETE bot config:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}