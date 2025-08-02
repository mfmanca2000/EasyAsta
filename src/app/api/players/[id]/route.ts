import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updatePlayerSchema = z.object({
  name: z.string().min(1, "Nome calciatore richiesto").optional(),
  position: z.enum(["P", "D", "C", "A"], { 
    message: "Ruolo deve essere P, D, C o A" 
  }).optional(),
  realTeam: z.string().min(1, "Squadra reale richiesta").optional(),
  price: z.number().min(1, "Prezzo deve essere maggiore di 0").optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Trova il calciatore con la lega
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        league: {
          select: {
            id: true,
            name: true,
            adminId: true,
          },
        },
        teamPlayers: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Calciatore non trovato" }, { status: 404 });
    }

    // Verifica che l'utente abbia accesso alla lega
    const hasAccess = player.league.adminId === user.id || 
      await prisma.team.findFirst({
        where: {
          leagueId: player.leagueId,
          userId: user.id,
        },
      });

    if (!hasAccess) {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    return NextResponse.json({ player });

  } catch (error) {
    console.error("Errore recupero calciatore:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const updateData = updatePlayerSchema.parse(body);

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Trova il calciatore con la lega
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        league: {
          select: {
            id: true,
            adminId: true,
            status: true,
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Calciatore non trovato" }, { status: 404 });
    }

    // Solo l'admin può modificare i calciatori
    if (player.league.adminId !== user.id) {
      return NextResponse.json({ error: "Solo l'admin può modificare i calciatori" }, { status: 403 });
    }

    // Verifica che la lega sia in stato SETUP
    if (player.league.status !== "SETUP") {
      return NextResponse.json({ error: "Impossibile modificare calciatori: lega non in setup" }, { status: 400 });
    }

    // Aggiorna il calciatore
    const updatedPlayer = await prisma.player.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ player: updatedPlayer });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Dati non validi", 
        details: error.issues 
      }, { status: 400 });
    }

    console.error("Errore aggiornamento calciatore:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Trova il calciatore con la lega
    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        league: {
          select: {
            id: true,
            adminId: true,
            status: true,
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: "Calciatore non trovato" }, { status: 404 });
    }

    // Solo l'admin può eliminare i calciatori
    if (player.league.adminId !== user.id) {
      return NextResponse.json({ error: "Solo l'admin può eliminare i calciatori" }, { status: 403 });
    }

    // Verifica che la lega sia in stato SETUP
    if (player.league.status !== "SETUP") {
      return NextResponse.json({ error: "Impossibile eliminare calciatori: lega non in setup" }, { status: 400 });
    }

    // Verifica che il calciatore non sia già assegnato
    if (player.isAssigned) {
      return NextResponse.json({ error: "Impossibile eliminare: calciatore già assegnato" }, { status: 400 });
    }

    // Elimina il calciatore
    await prisma.player.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Calciatore eliminato con successo" });

  } catch (error) {
    console.error("Errore eliminazione calciatore:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}