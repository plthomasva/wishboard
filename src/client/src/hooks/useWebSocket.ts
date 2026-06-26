import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

class RawWebSocketWrapper {
  private listeners: Record<string, Function[]> = {};
  private ws: WebSocket | null = null;
  public connected: boolean = false;

  constructor() {
    this.connect();
  }

  private connect() {
    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Fallback to routing over CloudFront /socket.io path or configured URL
    const wsUrl = (import.meta.env.VITE_WS_URL as string) || `${protocol}//${globalThis.location.host}/socket.io`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.trigger('connect');
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.trigger('disconnect');
        setTimeout(() => this.connect(), 3000); // Reconnect interval
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event) {
            this.trigger(payload.event, payload.data);
          }
        } catch (err) {
          console.error('Error parsing raw WebSocket message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Raw WebSocket error:', err);
      };
    } catch (err) {
      console.error('Failed to initialize raw WebSocket connection:', err);
      setTimeout(() => this.connect(), 3000);
    }
  }

  public on(event: string, cb: Function) {
    this.listeners[event] ??= [];
    this.listeners[event].push(cb);
  }

  public off(event: string, cb: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== cb);
  }

  private trigger(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((cb) => cb(data));
  }
}

// Global instances
let socketInstance: Socket | null = null;
let rawInstance: RawWebSocketWrapper | null = null;

export const getSocket = (): any => {
  const isRawMode =
    import.meta.env.VITE_USE_RAW_WEBSOCKETS === 'true' ||
    ((window as any).__WISHBOARD_CONFIG__?.realtimeProvider === 'apigateway');

  if (isRawMode) {
    rawInstance ??= new RawWebSocketWrapper();
    return rawInstance;
  } else {
    socketInstance ??= io(globalThis.location.origin, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    return socketInstance;
  }
};

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Initial state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket: getSocket(), isConnected };
};
