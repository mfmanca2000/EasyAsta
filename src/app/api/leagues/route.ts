import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createLeagueSchema = z.object({
  name: z.string().min(1, "Nome lega richiesto").max(50, "Nome troppo lungo"),
  credits: z.number().min(100, "Minimo 100 crediti").max(1000, "Massimo 1000 crediti").default(500),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const { name, credits } = createLeagueSchema.parse(body);

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Crea la lega
    const league = await prisma.league.create({
      data: {
        name,
        credits,
        adminId: user.id,
        status: "SETUP",
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teams: {
          include: {
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
    });

    return NextResponse.json({ league }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dati non validi", details: error.issues }, { status: 400 });
    }

    console.error("Errore creazione lega:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    // Trova tutte le leghe dove l'utente è admin o partecipante
    const leagues = await prisma.league.findMany({
      where: {
        OR: [{ adminId: user.id }, { teams: { some: { userId: user.id } } }],
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teams: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            teams: true,
            players: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ leagues });
  } catch (error) {
    console.error("Errore recupero leghe:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
