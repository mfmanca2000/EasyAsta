import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!leagueId) {
      return NextResponse.json({ error: "League ID required" }, { status: 400 });
    }

    // Check if user is admin of the league
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { adminId: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user || league.adminId !== user.id) {
      return NextResponse.json({ error: "Only league admin can access audit trail" }, { status: 403 });
    }

    // Fetch audit trail logs
    const auditLogs = await prisma.adminAction.findMany({
      where: { leagueId },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        targetTeam: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            realTeam: true,
            price: true,
          },
        },
        round: {
          select: {
            id: true,
            position: true,
            roundNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.adminAction.count({
      where: { leagueId },
    });

    return NextResponse.json({
      auditLogs,
      totalCount,
      hasMore: offset + limit < totalCount,
    });
  } catch (error) {
    console.error("Audit trail fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch audit trail" }, { status: 500 });
  }
}
