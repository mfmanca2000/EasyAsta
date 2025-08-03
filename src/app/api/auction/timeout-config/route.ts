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

const timeoutConfigSchema = z.object({
  leagueId: z.string().cuid(),
  timeoutSeconds: z.number().min(10).max(300), // Min 10s, Max 5min
  autoSelectOnTimeout: z.boolean(),
  pauseOnDisconnect: z.boolean().optional().default(false),
})

const getTimeoutConfigSchema = z.object({
  leagueId: z.string().cuid(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { leagueId, timeoutSeconds, autoSelectOnTimeout, pauseOnDisconnect } = timeoutConfigSchema.parse(body)

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        admin: {
          email: session.user.email
        }
      }
    })

    if (!league) {
      return NextResponse.json({ 
        error: 'Lega non trovata o non autorizzato' 
      }, { status: 404 })
    }

    // Upsert configurazione timeout
    const config = await prisma.auctionConfig.upsert({
      where: {
        leagueId: leagueId
      },
      update: {
        timeoutSeconds,
        autoSelectOnTimeout,
        pauseOnDisconnect,
        updatedAt: new Date()
      },
      create: {
        leagueId,
        timeoutSeconds,
        autoSelectOnTimeout,
        pauseOnDisconnect
      }
    })

    // Log dell'azione admin
    await prisma.adminAction.create({
      data: {
        leagueId,
        adminId: session.user.id!,
        action: 'TIMEOUT_CONFIG',
        reason: 'Configurazione timeout aggiornata',
        metadata: {
          oldConfig: {}, // Potremmo salvare la config precedente
          newConfig: {
            timeoutSeconds,
            autoSelectOnTimeout,
            pauseOnDisconnect
          }
        }
      }
    })

    // Emetti evento Socket.io per notificare il cambio configurazione
    if (globalThis.io) {
      globalThis.io.to(`auction-${leagueId}`).emit('timeout-config-updated', {
        leagueId,
        timeoutSeconds,
        autoSelectOnTimeout,
        pauseOnDisconnect,
        adminName: session.user.name || session.user.email
      })
    }

    return NextResponse.json({
      config,
      message: 'Configurazione timeout aggiornata con successo'
    })

  } catch (error) {
    console.error('Errore configurazione timeout:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dati richiesta non validi', 
        details: error.issues 
      }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'LeagueId richiesto' }, { status: 400 })
    }

    const { leagueId: validatedLeagueId } = getTimeoutConfigSchema.parse({ leagueId })

    // Verifica accesso alla lega (admin o partecipante)
    const hasAccess = await prisma.league.findFirst({
      where: {
        id: validatedLeagueId,
        OR: [
          { admin: { email: session.user.email } },
          { teams: { some: { user: { email: session.user.email } } } }
        ]
      }
    })

    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Accesso negato alla lega' 
      }, { status: 403 })
    }

    // Ottieni configurazione timeout (o default se non esiste)
    const config = await prisma.auctionConfig.findUnique({
      where: {
        leagueId: validatedLeagueId
      }
    })

    // Restituisci config esistente o valori default
    const responseConfig = config || {
      leagueId: validatedLeagueId,
      timeoutSeconds: 30,
      autoSelectOnTimeout: true,
      pauseOnDisconnect: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return NextResponse.json(responseConfig)

  } catch (error) {
    console.error('Errore recupero configurazione timeout:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Dati richiesta non validi', 
        details: error.issues 
      }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}