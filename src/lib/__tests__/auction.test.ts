import { resolveRound, createNextRound } from '../auction';
import { prisma } from '../prisma';

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    auctionRound: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    teamPlayer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    player: {
      update: jest.fn(),
    },
    playerSelection: {
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    league: {
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('auction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNextRound', () => {
    it('should create a new round successfully', async () => {
      const newRoundData = {
        id: 'round-123',
        leagueId: 'league-123',
        position: 'P',
        roundNumber: 2,
        status: 'SELECTION',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedPrisma.$transaction.mockImplementation((callback) => 
        callback({
          auctionRound: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(null) // No active round
              .mockResolvedValueOnce({     // Previous round for numbering
                id: 'prev-round',
                roundNumber: 1,
              }),
            create: jest.fn().mockResolvedValue(newRoundData),
          },
        } as any)
      );

      const result = await createNextRound('league-123', 'P');

      expect(result).toEqual(newRoundData);
      expect(mockedPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error if active round exists', async () => {
      mockedPrisma.$transaction.mockImplementation((callback) =>
        callback({
          auctionRound: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({
                id: 'active-round',
                status: 'SELECTION',
              }),
          },
        } as any)
      );

      await expect(createNextRound('league-123', 'P')).rejects.toThrow('Esiste già un turno attivo');
    });

    it('should create first round with roundNumber 1', async () => {
      const newRoundData = {
        id: 'round-123',
        leagueId: 'league-123',
        position: 'P',
        roundNumber: 1,
        status: 'SELECTION',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedPrisma.$transaction.mockImplementation((callback) =>
        callback({
          auctionRound: {
            findFirst: jest.fn()
              .mockResolvedValueOnce(null) // No active round
              .mockResolvedValueOnce(null), // No previous rounds
            create: jest.fn().mockResolvedValue(newRoundData),
          },
        } as any)
      );

      const result = await createNextRound('league-123', 'D');

      expect(result.roundNumber).toBe(1);
    });
  });

  describe('resolveRound', () => {
    const mockRound = {
      id: 'round-123',
      leagueId: 'league-123',
      position: 'P',
      roundNumber: 1,
      status: 'RESOLUTION',
      league: {
        id: 'league-123',
        name: 'Test League',
        adminId: 'admin-123',
        credits: 500,
        status: 'AUCTION',
      },
      selections: [
        {
          id: 'selection-1',
          roundId: 'round-123',
          userId: 'user-1',
          playerId: 'player-1',
          randomNumber: null,
          isWinner: false,
          isAdminSelection: false,
          adminReason: null,
          createdAt: new Date(),
          user: {
            id: 'user-1',
            name: 'User 1',
            email: 'user1@test.com',
            image: null,
            role: 'PLAYER',
            isBot: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: null,
          },
          player: {
            id: 'player-1',
            name: 'TEST PLAYER',
            position: 'P',
            realTeam: 'test',
            price: 20,
            leagueId: 'league-123',
            isAssigned: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    };

    const mockTeams = [
      {
        id: 'team-1',
        name: 'Team 1',
        userId: 'user-1',
        leagueId: 'league-123',
        remainingCredits: 500,
        teamPlayers: [],
      },
      {
        id: 'team-2',
        name: 'Team 2',
        userId: 'user-2',
        leagueId: 'league-123',
        remainingCredits: 500,
        teamPlayers: [],
      },
    ];

    it('should resolve round with single selection (no conflict)', async () => {
      mockedPrisma.auctionRound.findFirst.mockResolvedValue(mockRound);
      
      // Mock the team.findMany call that happens outside the transaction
      mockedPrisma.team.findMany.mockResolvedValue(mockTeams);

      mockedPrisma.$transaction.mockImplementation((callback) =>
        callback({
          team: {
            findMany: jest.fn().mockResolvedValue(mockTeams),
            update: jest.fn().mockResolvedValue({}),
          },
          teamPlayer: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          player: {
            update: jest.fn().mockResolvedValue({}),
          },
          playerSelection: {
            update: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          auctionRound: {
            update: jest.fn().mockResolvedValue({}),
          },
          league: {
            update: jest.fn().mockResolvedValue({}),
          },
        } as any)
      );

      const result = await resolveRound('round-123');

      expect(result).toBeDefined();
      expect(result.assignments).toHaveLength(1);
      expect(result.conflicts).toHaveLength(0);
      expect(result.assignments[0]).toEqual({
        playerId: 'player-1',
        winnerId: 'user-1',
        winnerName: 'User 1',
        playerName: 'TEST PLAYER',
        price: 20,
      });
    });

    it('should handle conflicts with multiple selections', async () => {
      const mockRoundWithConflicts = {
        ...mockRound,
        selections: [
          mockRound.selections[0],
          {
            ...mockRound.selections[0],
            id: 'selection-2',
            userId: 'user-2',
            user: {
              ...mockRound.selections[0].user,
              id: 'user-2',
              name: 'User 2',
              email: 'user2@test.com',
            },
          },
        ],
      };

      mockedPrisma.auctionRound.findFirst.mockResolvedValue(mockRoundWithConflicts as any);
      
      // Mock the team.findMany call that happens outside the transaction
      mockedPrisma.team.findMany.mockResolvedValue(mockTeams);

      mockedPrisma.$transaction.mockImplementation((callback) =>
        callback({
          team: {
            findMany: jest.fn().mockResolvedValue(mockTeams),
            update: jest.fn().mockResolvedValue({}),
          },
          teamPlayer: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          player: {
            update: jest.fn().mockResolvedValue({}),
          },
          playerSelection: {
            update: jest.fn().mockResolvedValue({}),
            deleteMany: jest.fn().mockResolvedValue({}),
          },
          auctionRound: {
            update: jest.fn().mockResolvedValue({}),
          },
        } as any)
      );

      const result = await resolveRound('round-123');

      expect(result.conflicts).toHaveLength(1);
      expect(result.assignments).toHaveLength(1);
      expect(result.conflicts[0].conflicts).toHaveLength(2);
    });

    it('should throw error if round not found', async () => {
      mockedPrisma.auctionRound.findFirst.mockResolvedValue(null);

      await expect(resolveRound('nonexistent-round')).rejects.toThrow('Turno non trovato');
    });

    it('should handle insufficient credits', async () => {
      const mockRoundInsufficientCredits = {
        ...mockRound,
        selections: [{
          ...mockRound.selections[0],
          player: {
            ...mockRound.selections[0].player,
            price: 1000, // More than team credits
          },
        }],
      };

      const mockTeamLowCredits = [{
        ...mockTeams[0],
        remainingCredits: 100, // Less than player price
      }];

      mockedPrisma.auctionRound.findFirst.mockResolvedValue(mockRoundInsufficientCredits as any);
      
      // Mock the team.findMany call that happens outside the transaction  
      mockedPrisma.team.findMany.mockResolvedValue(mockTeamLowCredits);

      mockedPrisma.$transaction.mockImplementation((callback) =>
        callback({
          team: {
            findMany: jest.fn().mockResolvedValue(mockTeamLowCredits),
          },
          auctionRound: {
            update: jest.fn().mockResolvedValue({}),
          },
        } as any)
      );

      const result = await resolveRound('round-123');

      expect(result.assignments).toHaveLength(0); // No assignments due to insufficient credits
    });

    it('should handle roster position limits', async () => {
      const mockTeamWithFullRoster = [{
        ...mockTeams[0],
        teamPlayers: Array(3).fill({
          player: { position: 'P' },
        }), // Already 3 goalkeepers (max)
      }];

      mockedPrisma.auctionRound.findFirst.mockResolvedValue(mockRound);
      
      // Mock the team.findMany call that happens outside the transaction
      mockedPrisma.team.findMany.mockResolvedValue(mockTeamWithFullRoster);

      mockedPrisma.$transaction.mockImplementation((callback) =>
        callback({
          team: {
            findMany: jest.fn().mockResolvedValue(mockTeamWithFullRoster),
          },
          auctionRound: {
            update: jest.fn().mockResolvedValue({}),
          },
        } as any)
      );

      const result = await resolveRound('round-123');

      expect(result.assignments).toHaveLength(0); // No assignments due to roster limits
    });
  });
});