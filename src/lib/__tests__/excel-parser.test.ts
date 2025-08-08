import * as XLSX from 'xlsx';
import { parseExcelFile, validatePlayerList, PlayerData } from '../excel-parser';

// Mock XLSX module
jest.mock('xlsx', () => ({
  read: jest.fn(),
  utils: {
    sheet_to_json: jest.fn(),
  },
}));

const mockedXLSX = XLSX as jest.Mocked<typeof XLSX>;

describe('excel-parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseExcelFile', () => {
    it('should parse valid Excel data correctly', () => {
      const mockSheetData = [
        // Headers and empty rows (0-4)
        [],
        [],
        [],
        [],
        ['ID', 'Giocatore', 'Squadra', 'Ruolo', 'Ruolo Mod. Av.', 'Fuori lista', 'Quotazione'],
        // Player data starts from row 5
        ['1', 'DONNARUMMA', 'MILAN', 'P', '', '', 25],
        ['2', 'THEO HERNANDEZ', 'MILAN', 'D', '', '', 20],
        ['3', 'KESSIE', 'MILAN', 'C', '', '', 15],
        ['4', 'IBRAHIMOVIC', 'MILAN', 'A', '', '', 30],
      ];

      mockedXLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      } as any);

      mockedXLSX.utils.sheet_to_json.mockReturnValue(mockSheetData);

      const buffer = new ArrayBuffer(0);
      const result = parseExcelFile(buffer);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.players).toHaveLength(4);
      
      expect(result.players[0]).toEqual({
        name: 'DONNARUMMA',
        position: 'P',
        realTeam: 'milan',
        price: 25,
      });
    });

    it('should skip players marked as "fuori lista"', () => {
      const mockSheetData = [
        // Headers
        [], [], [], [],
        ['ID', 'Giocatore', 'Squadra', 'Ruolo', 'Ruolo Mod. Av.', 'Fuori lista', 'Quotazione'],
        // Player data
        ['1', 'PLAYER1', 'TEAM1', 'P', '', '*', 25], // Should be skipped
        ['2', 'PLAYER2', 'TEAM2', 'D', '', '', 20], // Should be included
      ];

      mockedXLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      mockedXLSX.utils.sheet_to_json.mockReturnValue(mockSheetData);

      const result = parseExcelFile(new ArrayBuffer(0));

      expect(result.success).toBe(true);
      expect(result.players).toHaveLength(1);
      expect(result.players[0].name).toBe('PLAYER2');
    });

    it('should skip players with position "M"', () => {
      const mockSheetData = [
        [], [], [], [],
        ['ID', 'Giocatore', 'Squadra', 'Ruolo', 'Ruolo Mod. Av.', 'Fuori lista', 'Quotazione'],
        ['1', 'PLAYER1', 'TEAM1', 'M', '', '', 25], // Should be skipped
        ['2', 'PLAYER2', 'TEAM2', 'D', '', '', 20], // Should be included
      ];

      mockedXLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      mockedXLSX.utils.sheet_to_json.mockReturnValue(mockSheetData);

      const result = parseExcelFile(new ArrayBuffer(0));

      expect(result.success).toBe(true);
      expect(result.players).toHaveLength(1);
      expect(result.players[0].position).toBe('D');
    });

    it('should handle validation errors', () => {
      const mockSheetData = [
        [], [], [], [],
        ['ID', 'Giocatore', 'Squadra', 'Ruolo', 'Ruolo Mod. Av.', 'Fuori lista', 'Quotazione'],
        ['1', '', 'TEAM1', 'P', '', '', 25], // Missing name - gets skipped, no error generated
        ['2', 'PLAYER2', '', 'D', '', '', 20], // Missing team
        ['3', 'PLAYER3', 'TEAM3', 'X', '', '', 15], // Invalid position
        ['4', 'PLAYER4', 'TEAM4', 'A', '', '', -5], // Invalid price
      ];

      mockedXLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      mockedXLSX.utils.sheet_to_json.mockReturnValue(mockSheetData);

      const result = parseExcelFile(new ArrayBuffer(0));

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3); // Only 3 errors: missing team, invalid position, invalid price
      expect(result.players).toHaveLength(0);
      expect(result.errors).toEqual([
        "Riga 7: Squadra mancante per PLAYER2",
        "Riga 8: Ruolo \"X\" non valido per PLAYER3 (deve essere P, D, C, A)",
        "Riga 9: Prezzo non valido per PLAYER4 (deve essere ≥ 1)"
      ]);
    });

    it('should handle Excel reading errors', () => {
      mockedXLSX.read.mockImplementation(() => {
        throw new Error('Cannot read Excel file');
      });

      const result = parseExcelFile(new ArrayBuffer(0));

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Errore parsing file Excel');
      expect(result.players).toHaveLength(0);
    });

    it('should normalize player data correctly', () => {
      const mockSheetData = [
        [], [], [], [],
        ['ID', 'Giocatore', 'Squadra', 'Ruolo', 'Ruolo Mod. Av.', 'Fuori lista', 'Quotazione'],
        ['1', '  donnarumma  ', '  MILAN  ', 'P', '', '', 25.7], // Should be trimmed and normalized
      ];

      mockedXLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      mockedXLSX.utils.sheet_to_json.mockReturnValue(mockSheetData);

      const result = parseExcelFile(new ArrayBuffer(0));

      expect(result.success).toBe(true);
      expect(result.players[0]).toEqual({
        name: 'DONNARUMMA',
        position: 'P',
        realTeam: 'milan',
        price: 26, // Should be rounded
      });
    });
  });

  describe('validatePlayerList', () => {
    it('should return no errors for valid player list', () => {
      const players: PlayerData[] = [
        ...Array(15).fill(null).map((_, i) => ({ name: `P${i}`, position: 'P' as const, realTeam: 'team', price: 10 })),
        ...Array(50).fill(null).map((_, i) => ({ name: `D${i}`, position: 'D' as const, realTeam: 'team', price: 10 })),
        ...Array(50).fill(null).map((_, i) => ({ name: `C${i}`, position: 'C' as const, realTeam: 'team', price: 10 })),
        ...Array(40).fill(null).map((_, i) => ({ name: `A${i}`, position: 'A' as const, realTeam: 'team', price: 10 })),
      ];

      const errors = validatePlayerList(players);
      expect(errors).toHaveLength(0);
    });

    it('should return error for empty player list', () => {
      const errors = validatePlayerList([]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Nessun calciatore trovato');
    });

    it('should detect duplicate players', () => {
      const players: PlayerData[] = [
        { name: 'PLAYER1', position: 'P', realTeam: 'team', price: 10 },
        { name: 'PLAYER1', position: 'D', realTeam: 'team', price: 10 },
        { name: 'PLAYER2', position: 'C', realTeam: 'team', price: 10 },
        { name: 'PLAYER2', position: 'A', realTeam: 'team', price: 10 },
      ];

      const errors = validatePlayerList(players);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('PLAYER1'))).toBe(true);
      expect(errors.some(e => e.includes('PLAYER2'))).toBe(true);
    });

    it('should detect insufficient players by position', () => {
      const players: PlayerData[] = [
        // Too few of each position
        { name: 'P1', position: 'P', realTeam: 'team', price: 10 }, // Need 10
        { name: 'D1', position: 'D', realTeam: 'team', price: 10 }, // Need 40
        { name: 'C1', position: 'C', realTeam: 'team', price: 10 }, // Need 40
        { name: 'A1', position: 'A', realTeam: 'team', price: 10 }, // Need 30
      ];

      const errors = validatePlayerList(players);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('portieri'))).toBe(true);
      expect(errors.some(e => e.includes('difensori'))).toBe(true);
      expect(errors.some(e => e.includes('centrocampisti'))).toBe(true);
      expect(errors.some(e => e.includes('attaccanti'))).toBe(true);
    });

    it('should count positions correctly', () => {
      const players: PlayerData[] = [
        ...Array(5).fill(null).map((_, i) => ({ name: `P${i}`, position: 'P' as const, realTeam: 'team', price: 10 })),
      ];

      const errors = validatePlayerList(players);
      const portierError = errors.find(e => e.includes('portieri'));
      expect(portierError).toContain('5 (minimo consigliato: 10)');
    });
  });
});