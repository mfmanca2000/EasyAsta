import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ApiResponse } from "@/types";

// Get global Socket.io instance
interface GlobalSocket {
  io?: import("socket.io").Server;
}

declare const globalThis: GlobalSocket & typeof global;

const startAuctionSchema = z.object({
  leagueId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorizzato", success: false } as ApiResponse, { status: 401 });
    }

    const body = await request.json();
    const { leagueId } = startAuctionSchema.parse(body);

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        admin: {
          email: session.user.email,
        },
      },
      include: {
        teams: true,
        players: {
          where: { isAssigned: false },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "Lega non trovata o non autorizzato", success: false } as ApiResponse, { status: 404 });
    }

    // Verifica che ci siano abbastanza squadre (4-8)
    if (league.teams.length < 4 || league.teams.length > 8) {
      return NextResponse.json(
        {
          error: "Numero squadre non valido. Devono essere tra 4 e 8.",
          success: false,
        } as ApiResponse,
        { status: 400 }
      );
    }

    // Verifica che ci siano calciatori disponibili
    if (league.players.length === 0) {
      return NextResponse.json(
        {
          error: "Nessun calciatore disponibile per l'asta",
          success: false,
        } as ApiResponse,
        { status: 400 }
      );
    }

    // Aggiorna stato lega per iniziare l'asta (senza creare il primo turno)
    // Prima pulisci eventuali turni attivi residui
    const updatedLeague = await prisma.$transaction(async (tx) => {
      // Elimina eventuali turni attivi che potrebbero essere rimasti
      await tx.auctionRound.deleteMany({
        where: {
          leagueId,
          status: {
            in: ["SELECTION", "RESOLUTION"],
          },
        },
      });

      // Aggiorna lo stato della lega
      return await tx.league.update({
        where: { id: leagueId },
        data: { status: "AUCTION" },
      });
    });

    // Emetti evento Socket.io per notificare l'avvio dell'asta
    if (globalThis.io) {
      globalThis.io.to(`auction-${leagueId}`).emit("auction-started", {
        leagueId,
        league: updatedLeague,
      });
    }

    return NextResponse.json({
      data: updatedLeague,
      success: true,
    } as ApiResponse);
  } catch (error) {
    console.error("Errore avvio asta:", error);
    return NextResponse.json({ error: "Errore interno del server", success: false } as ApiResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorizzato", success: false } as ApiResponse, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return NextResponse.json({ error: "LeagueId richiesto", success: false } as ApiResponse, { status: 400 });
    }

    // Verifica accesso alla lega e se è admin
    const userTeam = await prisma.team.findFirst({
      where: {
        leagueId,
        user: {
          email: session.user.email,
        },
      },
    });

    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        admin: {
          email: session.user.email,
        },
      },
    });

    const isAdmin = !!league;

    if (!userTeam && !isAdmin) {
      return NextResponse.json({ error: "Accesso negato alla lega", success: false } as ApiResponse, { status: 403 });
    }

    // Ottieni stato asta corrente
    const currentRound = await prisma.auctionRound.findFirst({
      where: {
        leagueId,
        status: {
          in: ["SELECTION", "RESOLUTION"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        selections: {
          include: {
            user: {
              select: { id: true, name: true },
            },
            player: true,
          },
        },
      },
    });

    if (!currentRound) {
      return NextResponse.json({
        error: "Nessun turno attivo",
        hasActiveRound: false,
      });
    }

    // Ottieni calciatori disponibili per il ruolo corrente
    const availablePlayers = await prisma.player.findMany({
      where: {
        leagueId,
        position: currentRound.position,
        isAssigned: false,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Verifica se l'utente ha già fatto una selezione in questo turno
    const userSelection = userTeam ? currentRound.selections.find((selection) => selection.user.id === userTeam.userId) : undefined;

    // Dati aggiuntivi per admin
    let teams, config;
    if (isAdmin) {
      teams = await prisma.team.findMany({
        where: { leagueId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { name: "asc" },
      });

      config = await prisma.auctionConfig.findUnique({
        where: { leagueId },
      });
    }

    return NextResponse.json({
      currentRound,
      availablePlayers,
      userSelection,
      teams: teams || undefined,
      config: config || undefined,
      hasActiveRound: true,
    });
  } catch (error) {
    console.error("Errore recupero stato asta:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
