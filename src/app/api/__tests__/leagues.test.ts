import { NextRequest } from 'next/server';
import { GET, POST } from '../leagues/route';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/prisma');

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/leagues', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'user@test.com',
      name: 'Test User',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/leagues', () => {
    it('should return leagues for authenticated user', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);
      
      const mockLeagues = [
        {
          id: 'league-1',
          name: 'Test League 1',
          status: 'SETUP',
          credits: 500,
          admin: {
            id: 'admin-1',
            name: 'Admin User',
            email: 'admin@test.com',
          },
          teams: [],
          _count: {
            teams: 0,
            players: 0,
          },
        },
        {
          id: 'league-2',
          name: 'Test League 2',
          status: 'AUCTION',
          credits: 500,
          admin: {
            id: 'admin-2',
            name: 'Admin User 2',
            email: 'admin2@test.com',
          },
          teams: [
            {
              id: 'team-1',
              name: 'My Team',
              user: {
                id: 'user-123',
                email: 'user@test.com',
                name: 'Test User',
              },
            },
          ],
          _count: {
            teams: 4,
            players: 100,
          },
        },
      ];

      mockedPrisma.league.findMany.mockResolvedValue(mockLeagues as any);

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leagues).toHaveLength(2);
      expect(data.leagues[0].name).toBe('Test League 1');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockedGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Non autenticato');
    });

    it('should handle database errors', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);
      mockedPrisma.league.findMany.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Errore interno del server');
    });
  });

  describe('POST /api/leagues', () => {
    const validLeagueData = {
      name: 'New Test League',
      credits: 500,
    };

    it('should create a new league', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);

      const mockCreatedLeague = {
        id: 'new-league-123',
        name: 'New Test League',
        adminId: 'user-123',
        credits: 500,
        status: 'SETUP',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedPrisma.league.create.mockResolvedValue(mockCreatedLeague as any);

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validLeagueData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.league.name).toBe('New Test League');
      expect(data.league.credits).toBe(500);
      expect(mockedPrisma.league.create).toHaveBeenCalledWith({
        data: {
          name: 'New Test League',
          adminId: 'user-123',
          credits: 500,
        },
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockedGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validLeagueData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Non autenticato');
    });

    it('should validate required fields', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);

      const invalidData = {
        credits: 500,
        // missing name
      };

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('validation');
    });

    it('should validate league name length', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);

      const invalidData = {
        name: 'A', // Too short
        credits: 500,
      };

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('validation');
    });

    it('should validate credits range', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);

      const invalidData = {
        name: 'Valid Name',
        credits: 50, // Too low
      };

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('validation');
    });

    it('should handle database creation errors', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);
      mockedPrisma.league.create.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validLeagueData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Errore interno del server');
    });

    it('should handle invalid JSON', async () => {
      mockedGetServerSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('JSON');
    });
  });
});