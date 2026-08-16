import React from "react";
import { render, cleanup } from "@testing-library/react";
import { useAuctionPusher } from "@/hooks/useAuctionPusher";

// Simula la connessione Pusher che oscilla rapidamente tra connesso e fallback
// (osservato in produzione), driving connectionStatus.fallbackMode a cambiare
// molte volte al secondo, per verificare che il rate cap la tenga sotto controllo.
let mockListeners: Array<(status: any) => void> = [];
let mockCurrentStatus = { isConnected: true, isLimitReached: false, lastError: null, reconnectAttempts: 0, fallbackMode: false };

const mockChannel = { bind: jest.fn(), unbind: jest.fn(), unbind_all: jest.fn() };
const mockPusherInstance = { subscribe: jest.fn(() => mockChannel), unsubscribe: jest.fn() };

jest.mock("@/lib/pusher-client", () => ({
  getPusherInstance: jest.fn(() => mockPusherInstance),
  addConnectionListener: jest.fn((cb) => mockListeners.push(cb)),
  removeConnectionListener: jest.fn((cb) => { mockListeners = mockListeners.filter((l) => l !== cb); }),
  getConnectionStatus: jest.fn(() => mockCurrentStatus),
}));

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners = [];
  mockCurrentStatus = { isConnected: true, isLimitReached: false, lastError: null, reconnectAttempts: 0, fallbackMode: false };
  fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ hasActiveRound: false }) }));
  global.fetch = fetchMock as any;
});

afterEach(() => cleanup());

function Parent({ leagueId }: { leagueId: string }) {
  useAuctionPusher({ leagueId });
  return null;
}

test("un rate cap contiene la raffica quando fallbackMode oscilla rapidamente", async () => {
  render(React.createElement(Parent, { leagueId: "league-1" }));
  await new Promise((r) => setTimeout(r, 50));

  // Simula ~200 flap connesso/fallback in mezzo secondo (piu' denso di quanto
  // pusher-js farebbe mai da solo, per stressare il caso peggiore).
  for (let i = 0; i < 200; i++) {
    mockCurrentStatus = { ...mockCurrentStatus, fallbackMode: i % 2 === 0 };
    mockListeners.forEach((cb) => cb({ ...mockCurrentStatus }));
    await new Promise((r) => setTimeout(r, 2));
  }

  await new Promise((r) => setTimeout(r, 100));

  console.log(`\n>>> Chiamate fetch durante 200 flap in ~500ms: ${fetchMock.mock.calls.length}\n`);
  // Senza il rate cap questo numero sarebbe nell'ordine delle centinaia (un fetch
  // per ogni transizione). Con il cap, al massimo ~1 ogni MIN_FETCH_INTERVAL_MS.
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
});
