// Central exports for all types - single import point

// Common types and constants
export * from "./common";

// Player types
export * from "./player";

// Team types  
export * from "./team";

// API types
export * from "./api";

// Socket event types
export * from "./socket-events";

// Note: next-auth.d.ts is a declaration file and should not be exported
// It's automatically picked up by TypeScript compiler

// League and auction types (inline definitions)
export interface League {
  id: string;
  name: string;
  adminId: string;
  joinCode: string;
  credits: number;
  status: "SETUP" | "AUCTION" | "COMPLETED";
  createdAt: Date;
  updatedAt: Date;
}

export interface AuctionRound {
  id: string;
  leagueId: string;
  position: "P" | "D" | "C" | "A";
  roundNumber: number;
  status: "SELECTION" | "RESOLUTION" | "COMPLETED";
  createdAt: Date;
  updatedAt: Date;
}

export interface AuctionConfig {
  id: string;
  leagueId: string;
  timeoutSeconds: number;
  autoSelectOnTimeout: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Note: Socket event types are now centralized in socket-events.ts

// Hook return types
export interface UseLoadingReturn {
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface UseApiReturn<T> extends UseLoadingReturn {
  data: T | null;
  refresh: () => Promise<void>;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  loading?: boolean;
  disabled?: boolean;
}

export interface LeagueComponentProps extends BaseComponentProps {
  leagueId: string;
  onRefresh?: () => void;
}

export interface AuctionComponentProps extends LeagueComponentProps {
  currentRound?: AuctionRound;
  isAdmin: boolean;
}