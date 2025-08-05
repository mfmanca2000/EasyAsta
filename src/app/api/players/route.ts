import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ApiResponse } from "@/types";

const createPlayerSchema = z.object({
  name: z.string().min(1, "Nome calciatore richiesto"),
  position: z.enum(["P", "D", "C", "A"] as const, {
    message: "Ruolo deve essere P, D, C o A",
  }),
  realTeam: z.string().min(1, "Squadra reale richiesta"),
  price: z.number().min(1, "Prezzo deve essere maggiore di 0"),
  leagueId: z.string().min(1, "ID lega richiesto"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato", success: false } as ApiResponse, { status: 401 });
    }

    const body = await request.json();
    const { leagueId, ...playerData } = createPlayerSchema.parse(body);

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Verifica che l'utente sia admin della lega
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        adminId: user.id,
      },
    });

    if (!league) {
      return NextResponse.json({ error: "Lega non trovata o accesso negato" }, { status: 403 });
    }

    // Verifica che la lega sia in stato SETUP
    if (league.status !== "SETUP") {
      return NextResponse.json({ error: "Impossibile modificare calciatori: lega non in setup" }, { status: 400 });
    }

    // Crea il calciatore
    const player = await prisma.player.create({
      data: {
        ...playerData,
        leagueId,
        isAssigned: false,
      },
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Dati non validi",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Errore creazione calciatore:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return NextResponse.json({ error: "ID lega richiesto" }, { status: 400 });
    }

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Verifica che l'utente abbia accesso alla lega (admin o partecipante)
    const league = await prisma.league.findFirst({
      where: {
        id: leagueId,
        OR: [{ adminId: user.id }, { teams: { some: { userId: user.id } } }],
      },
    });

    if (!league) {
      return NextResponse.json({ error: "Lega non trovata o accesso negato" }, { status: 403 });
    }

    // Ottieni parametri di filtro opzionali
    const position = searchParams.get("position");
    const search = searchParams.get("search");
    const available = searchParams.get("available");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortField = searchParams.get("sortField") || "name";
    const sortDirection = searchParams.get("sortDirection") || "asc";

    // Costruisci filtri
    const where: {
      leagueId: string;
      position?: "P" | "D" | "C" | "A";
      OR?: Array<{ name?: { contains: string; mode: "insensitive" }; realTeam?: { contains: string; mode: "insensitive" } }>;
      isAssigned?: boolean;
    } = { leagueId };

    if (position && ["P", "D", "C", "A"].includes(position)) {
      where.position = position as "P" | "D" | "C" | "A";
    }

    if (search) {
      where.OR = [{ name: { contains: search, mode: "insensitive" } }, { realTeam: { contains: search, mode: "insensitive" } }];
    }

    if (available === "true") {
      where.isAssigned = false;
    } else if (available === "false") {
      where.isAssigned = true;
    }

    // Ordinamento
    const getOrderBy = () => {
      const validFields = ["name", "position", "realTeam", "price", "isAssigned"];
      const field = validFields.includes(sortField) ? sortField : "name";
      const direction = sortDirection === "desc" ? "desc" : "asc";

      return { [field]: direction };
    };

    // Paginazione (se limit è -1, prendi tutti)
    const skip = limit === -1 ? 0 : (page - 1) * limit;
    const take = limit === -1 ? undefined : limit;

    const [players, totalCount] = await Promise.all([
      prisma.player.findMany({
        where,
        orderBy: getOrderBy(),
        skip,
        take,
      }),
      prisma.player.count({ where }),
    ]);

    // Statistiche per ruolo
    const stats = await prisma.player.groupBy({
      by: ["position"],
      where: { leagueId },
      _count: {
        id: true,
      },
    });

    const positionStats = stats.reduce((acc, stat) => {
      acc[stat.position] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      players,
      pagination: {
        page: limit === -1 ? 1 : page,
        limit: limit === -1 ? totalCount : limit,
        total: totalCount,
        totalPages: limit === -1 ? 1 : Math.ceil(totalCount / limit),
      },
      stats: positionStats,
    });
  } catch (error) {
    console.error("Errore recupero calciatori:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
