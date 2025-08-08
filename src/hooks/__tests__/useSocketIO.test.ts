import { renderHook, act, waitFor } from '@testing-library/react';
import { useSocketIO } from '../useSocketIO';
import { io } from 'socket.io-client';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
  id: 'mock-socket-id',
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

const mockedIo = io as jest.MockedFunction<typeof io>;

describe('useSocketIO', () => {
  const defaultProps = {
    leagueId: 'test-league-123',
    userId: 'test-user-123',
    userName: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    expect(result.current.isConnected).toBe(false);
    expect(result.current.socket).toBe(null);
  });

  it('should connect to socket when enabled', () => {
    renderHook(() => useSocketIO(defaultProps));

    expect(mockedIo).toHaveBeenCalledWith({
      path: '/api/socket',
      addTrailingSlash: false,
    });
  });

  it('should not connect when disabled', () => {
    renderHook(() => useSocketIO({ ...defaultProps, enabled: false }));

    expect(mockedIo).not.toHaveBeenCalled();
  });

  it('should join auction room on connection', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    act(() => {
      connectCallback?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join-auction', {
      leagueId: defaultProps.leagueId,
      userId: defaultProps.userId,
      userName: defaultProps.userName,
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should handle socket disconnection', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    // First connect
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    act(() => {
      connectCallback?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Then disconnect
    const disconnectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1];
    act(() => {
      disconnectCallback?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('should handle connection errors', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    const errorCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1];
    act(() => {
      errorCallback?.(new Error('Connection failed'));
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('should emit events through emit function', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    // Connect first
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    act(() => {
      connectCallback?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.emit('test-event', { data: 'test' });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  it('should not emit when disconnected', () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    act(() => {
      result.current.emit('test-event', { data: 'test' });
    });

    // Should not emit when disconnected (only join-auction should be called on connect)
    const emitCalls = mockSocket.emit.mock.calls.filter(call => call[0] === 'test-event');
    expect(emitCalls).toHaveLength(0);
  });

  it('should register event listeners through on function', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));
    const callback = jest.fn();

    act(() => {
      result.current.on('auction-state-changed', callback);
    });

    expect(mockSocket.on).toHaveBeenCalledWith('auction-state-changed', callback);
  });

  it('should remove event listeners through off function', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));
    const callback = jest.fn();

    act(() => {
      result.current.off('auction-state-changed', callback);
    });

    expect(mockSocket.off).toHaveBeenCalledWith('auction-state-changed', callback);
  });

  it('should remove all listeners for an event when no callback provided', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    act(() => {
      result.current.off('auction-state-changed');
    });

    expect(mockSocket.off).toHaveBeenCalledWith('auction-state-changed');
  });

  it('should start heartbeat on connection', async () => {
    const { result } = renderHook(() => useSocketIO(defaultProps));

    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    act(() => {
      connectCallback?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Fast forward 30 seconds to trigger heartbeat
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('heartbeat');
  });

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useSocketIO(defaultProps));

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('leave-auction', defaultProps.leagueId);
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should rejoin when leagueId changes', async () => {
    const { result, rerender } = renderHook(
      (props) => useSocketIO(props),
      { initialProps: defaultProps }
    );

    // Connect first
    const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1];
    act(() => {
      connectCallback?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Clear previous calls
    mockSocket.emit.mockClear();

    // Change leagueId
    rerender({
      ...defaultProps,
      leagueId: 'new-league-456',
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join-auction', {
      leagueId: 'new-league-456',
      userId: defaultProps.userId,
      userName: defaultProps.userName,
    });
  });

  it('should handle manual connect and disconnect', async () => {
    const { result } = renderHook(() => useSocketIO({ ...defaultProps, enabled: false }));

    // Initially not connected and mockedIo not called yet since enabled=false
    expect(result.current.isConnected).toBe(false);
    expect(mockedIo).not.toHaveBeenCalled();

    // Manual connect should respect enabled=false and not connect
    act(() => {
      result.current.connect();
    });

    // Should still not connect because enabled=false
    expect(mockedIo).not.toHaveBeenCalled();

    // Manual disconnect should work even when not connected
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });
});