const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function generateLeagueJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function updateExistingLeagues() {
  try {
    console.log('Fetching leagues without join codes...');
    
    const leagues = await prisma.league.findMany({
      where: {
        joinCode: null
      }
    });

    console.log(`Found ${leagues.length} leagues to update`);

    for (const league of leagues) {
      let joinCode;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      // Generate unique join code
      while (!isUnique && attempts < maxAttempts) {
        joinCode = generateLeagueJoinCode();
        const existingLeague = await prisma.league.findUnique({
          where: { joinCode }
        });
        if (!existingLeague) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        console.error(`Could not generate unique join code for league ${league.id}`);
        continue;
      }

      // Update league with join code
      await prisma.league.update({
        where: { id: league.id },
        data: { joinCode }
      });

      console.log(`Updated league "${league.name}" (${league.id}) with join code: ${joinCode}`);
    }

    console.log('✅ All existing leagues updated with join codes');
  } catch (error) {
    console.error('❌ Error updating leagues:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingLeagues();