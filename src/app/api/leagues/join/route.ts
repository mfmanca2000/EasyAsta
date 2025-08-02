import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const joinLeagueSchema = z.object({
  leagueId: z.string().min(1, "ID lega richiesto"),
  teamName: z.string().min(1, "Nome squadra richiesto").max(30, "Nome troppo lungo"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, teamName } = joinLeagueSchema.parse(body);

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Verifica che la lega esista e sia in stato SETUP
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        teams: true,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
    }

    if (league.status !== "SETUP") {
      return NextResponse.json({ error: "Lega non più aperta alle iscrizioni" }, { status: 400 });
    }

    // Verifica che ci siano meno di 8 squadre
    if (league.teams.length >= 8) {
      return NextResponse.json({ error: "Lega già al completo (max 8 squadre)" }, { status: 400 });
    }

    // Verifica che l'utente non sia già nella lega
    const existingTeam = await prisma.team.findUnique({
      where: {
        userId_leagueId: {
          userId: user.id,
          leagueId: leagueId,
        },
      },
    });

    if (existingTeam) {
      return NextResponse.json({ error: "Sei già iscritto a questa lega" }, { status: 400 });
    }

    // Verifica che il nome squadra non sia già usato nella lega
    const existingTeamName = await prisma.team.findFirst({
      where: {
        leagueId: leagueId,
        name: teamName,
      },
    });

    if (existingTeamName) {
      return NextResponse.json({ error: "Nome squadra già utilizzato in questa lega" }, { status: 400 });
    }

    // Crea la squadra
    const team = await prisma.team.create({
      data: {
        name: teamName,
        userId: user.id,
        leagueId: leagueId,
        remainingCredits: league.credits,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        league: {
          select: {
            id: true,
            name: true,
            credits: true,
          },
        },
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dati non validi", details: error.issues }, { status: 400 });
    }

    console.error("Errore partecipazione lega:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
