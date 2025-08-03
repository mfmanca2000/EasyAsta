import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createBotUsers, removeBotUsers } from '@/lib/bot-logic'

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

      if (isEnabled) {
        // Rimuovi eventuali bot esistenti
        await removeBotUsers(leagueId)
        
        // Crea nuovi bot
        const botUserIds = await createBotUsers(leagueId, botCount)
        
        // Aggiorna crediti bot basandosi sui crediti della lega
        await tx.team.updateMany({
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
    })

    const finalBotCount = await prisma.team.count({
      where: {
        leagueId,
        user: { isBot: true }
      }
    })

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

    await removeBotUsers(leagueId)

    // Disabilita configurazione bot
    await prisma.botConfig.upsert({
      where: { leagueId },
      update: { isEnabled: false },
      create: { leagueId, isEnabled: false }
    })

    return NextResponse.json({
      success: true,
      message: 'Tutti i bot sono stati rimossi dalla lega'
    })

  } catch (error) {
    console.error('Errore DELETE bot config:', error)
    return NextResponse.json({ error: 'Errore server' }, { status: 500 })
  }
}