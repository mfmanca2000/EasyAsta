// Standard API response types

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Error response
export interface ApiError {
  error: string;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Admin action types
export interface AdminActionRequest {
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminSelectRequest extends AdminActionRequest {
  roundId: string;
  playerId: string;
  targetTeamId: string;
}

export interface AdminOverrideRequest extends AdminActionRequest {
  roundId: string;
  targetTeamId?: string;
}

export interface TimeoutConfigRequest {
  leagueId: string;
  timeoutSeconds: number;
  autoSelectOnTimeout: boolean;
}

// Bot configuration
export interface BotConfigRequest {
  leagueId: string;
  enabled: boolean;
  selectionDelay?: number;
  testMode?: boolean;
}

// Auction state response
export interface AuctionStateResponse {
  league: {
    id: string;
    name: string;
    status: string;
    credits: number;
  };
  currentRound?: {
    id: string;
    position: string;
    roundNumber: number;
    status: string;
  };
  teams: Array<{
    id: string;
    name: string;
    userId: string;
    remainingCredits: number;
    user: {
      id: string;
      name?: string;
      email: string;
    };
  }>;
  isAdmin: boolean;
  config?: {
    timeoutSeconds: number;
    autoSelectOnTimeout: boolean;
  };
}

// Player import response
export interface PlayerImportResponse extends ApiResponse {
  imported: number;
  skipped: number;
  errors: string[];
}

// Audit log response
//export interface AuditLogResponse extends PaginatedResponse<AuditLogEntry> {}

export interface AuditLogEntry {
  id: string;
  action: string;
  adminName: string;
  targetTeam?: string;
  player?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
