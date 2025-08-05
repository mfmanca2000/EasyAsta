import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseExcelFile, validatePlayerList } from "@/lib/excel-parser";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error: "Non autenticato",
          success: false,
        } as ApiResponse,
        { status: 401 }
      );
    }

    // Ottieni i dati dal form
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const leagueId = formData.get("leagueId") as string;

    if (!file) {
      return NextResponse.json(
        {
          error: "File Excel richiesto",
          success: false,
        } as ApiResponse,
        { status: 400 }
      );
    }

    if (!leagueId) {
      return NextResponse.json(
        {
          error: "ID lega richiesto",
          success: false,
        } as ApiResponse,
        { status: 400 }
      );
    }

    // Verifica tipo file
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        {
          error: "Formato file non supportato. Utilizzare .xlsx o .xls",
          success: false,
        } as ApiResponse,
        { status: 400 }
      );
    }

    // Trova l'utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Utente non trovato",
          success: false,
        } as ApiResponse,
        { status: 404 }
      );
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
      return NextResponse.json({ error: "Impossibile importare calciatori: lega non in setup" }, { status: 400 });
    }

    // Leggi il file Excel
    const buffer = await file.arrayBuffer();
    const parseResult = parseExcelFile(buffer);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Errori nel parsing del file",
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // Validazione aggiuntiva
    const validationErrors = validatePlayerList(parseResult.players);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Errori di validazione",
          details: validationErrors,
          warning: true,
        },
        { status: 400 }
      );
    }

    // Transazione per eliminare e reinserire calciatori
    const result = await prisma.$transaction(async (tx) => {
      // Elimina tutti i calciatori esistenti per questa lega
      await tx.player.deleteMany({
        where: { leagueId },
      });

      // Inserisci i nuovi calciatori
      const createdPlayers = await tx.player.createMany({
        data: parseResult.players.map((player) => ({
          ...player,
          leagueId,
          isAssigned: false,
        })),
      });

      return createdPlayers;
    });

    return NextResponse.json(
      {
        message: "Calciatori importati con successo",
        count: result.count,
        summary: {
          portieri: parseResult.players.filter((p) => p.position === "P").length,
          difensori: parseResult.players.filter((p) => p.position === "D").length,
          centrocampisti: parseResult.players.filter((p) => p.position === "C").length,
          attaccanti: parseResult.players.filter((p) => p.position === "A").length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore import calciatori:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
