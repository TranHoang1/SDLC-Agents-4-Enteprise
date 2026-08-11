/**
 * SA4E-85 — IPC Bridge Implementation (Tasks 7.2, 7.4).
 * WebSocket connection manager with exponential backoff reconnect.
 * BR-13: 1s, 2s, 4s, 8s, 16s — max 5 retries then offline.
 * BR-14: Localhost-only validation enforced at connect time.
 * [TDD-Review-01]: dispose() pushed into ExtensionContext.subscriptions.
 */

import * as vscode from 'vscode';
import { WebSocket } from 'ws';
import { JsonRpcClient } from './jsonRpcClient';
import { isLocalhostEndpoint } from './serviceDiscovery';
import type { IIpcBridge, ServiceDiscovery, ServiceStatus, StatusChangeEvent } from './IIpcBridge';

/** BR-13: Backoff delays in milliseconds */
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000];
/** BR-13: Maximum retry attempts before marking offline */
const MAX_RETRIES = 5;

/** Per-service connection state */
interface ServiceConnection {
  serviceId: string;
  discovery: ServiceDiscovery;
  socket: WebSocket | null;
  rpcClient: JsonRpcClient;
  status: ServiceStatus;
  retryCount: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * IpcBridge — concrete WebSocket-based IPC with JSON-RPC 2.0.
 * Supports dual connections to Kiro + AntiGravity simultaneously.
 */
export class IpcBridge implements IIpcBridge, vscode.Disposable {
  private readonly connections = new Map<string, ServiceConnection>();
  private readonly emitter = new vscode.EventEmitter<StatusChangeEvent>();
  private disposed = false;

  /** Event: fired on any service status transition */
  readonly onStatusChanged: vscode.Event<StatusChangeEvent> = this.emitter.event;

  /** Connect to a discovered service (BR-14 validated) */
  async connect(discovery: ServiceDiscovery): Promise<void> {
    if (this.disposed) return;
    if (!isLocalhostEndpoint(discovery.ws_endpoint)) {
      throw new Error(`BR-14 violation: non-localhost endpoint rejected: ${discovery.ws_endpoint}`);
    }
    const serviceId = this.deriveServiceId(discovery);
    this.disconnectExisting(serviceId);

    const conn: ServiceConnection = {
      serviceId,
      discovery,
      socket: null,
      rpcClient: new JsonRpcClient(),
      status: 'connecting',
      retryCount: 0,
      reconnectTimer: null,
    };
    this.connections.set(serviceId, conn);
    this.emitStatus(serviceId, 'connecting');
    this.openSocket(conn);
  }

  /** Disconnect a specific service */
  disconnect(serviceId: string): void {
    this.disconnectExisting(serviceId);
    this.connections.delete(serviceId);
  }

  /** Send a JSON-RPC 2.0 call to a connected service */
  async call(serviceId: string, method: string, params: unknown): Promise<unknown> {
    const conn = this.connections.get(serviceId);
    if (!conn || conn.status !== 'connected' || !conn.socket) {
      throw new Error(`Service '${serviceId}' is not connected`);
    }
    const { message, promise } = conn.rpcClient.createRequest(method, params);
    conn.socket.send(message);
    return promise;
  }

  /** Get status snapshot for all tracked services */
  getStatus(): Map<string, ServiceStatus> {
    const result = new Map<string, ServiceStatus>();
    for (const [id, conn] of this.connections) {
      result.set(id, conn.status);
    }
    return result;
  }

  /** Cleanup all connections and timers */
  dispose(): void {
    this.disposed = true;
    for (const [, conn] of this.connections) {
      this.cleanupConnection(conn);
    }
    this.connections.clear();
    this.emitter.dispose();
  }

  /** Open a WebSocket to the service endpoint */
  private openSocket(conn: ServiceConnection): void {
    if (this.disposed) return;
    try {
      conn.socket = new WebSocket(conn.discovery.ws_endpoint);
      conn.socket.on('open', () => this.handleOpen(conn));
      conn.socket.on('message', (data) => this.handleMessage(conn, data));
      conn.socket.on('close', () => this.handleClose(conn));
      conn.socket.on('error', () => this.handleClose(conn));
    } catch (err) {
      this.scheduleReconnect(conn);
    }
  }

  private handleOpen(conn: ServiceConnection): void {
    conn.status = 'connected';
    conn.retryCount = 0;
    this.emitStatus(conn.serviceId, 'connected');
  }

  private handleMessage(conn: ServiceConnection, data: unknown): void {
    const raw = typeof data === 'string' ? data : data?.toString() ?? '';
    conn.rpcClient.handleResponse(raw);
  }

  /** Handle socket close — trigger exponential backoff (BR-13) */
  private handleClose(conn: ServiceConnection): void {
    if (this.disposed) return;
    conn.socket = null;
    if (conn.status === 'connected') {
      conn.rpcClient.rejectAll('Connection lost');
    }
    conn.status = 'disconnected';
    this.emitStatus(conn.serviceId, 'disconnected');
    this.scheduleReconnect(conn);
  }

  /** BR-13: Schedule reconnect with exponential backoff */
  private scheduleReconnect(conn: ServiceConnection): void {
    if (this.disposed) return;
    if (conn.retryCount >= MAX_RETRIES) {
      conn.status = 'offline';
      this.emitStatus(conn.serviceId, 'offline');
      return;
    }
    const delay = BACKOFF_DELAYS[conn.retryCount] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
    conn.retryCount++;
    conn.reconnectTimer = setTimeout(() => {
      if (this.disposed) return;
      conn.status = 'connecting';
      this.emitStatus(conn.serviceId, 'connecting');
      this.openSocket(conn);
    }, delay);
  }

  private disconnectExisting(serviceId: string): void {
    const existing = this.connections.get(serviceId);
    if (existing) {
      this.cleanupConnection(existing);
    }
  }

  private cleanupConnection(conn: ServiceConnection): void {
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    conn.rpcClient.rejectAll('Disconnected');
    if (conn.socket) {
      try { conn.socket.close(); } catch (err) { console.debug('[IpcBridge] ignore :', (err as Error).message); }
      conn.socket = null;
    }
  }

  /** Derive service ID from the endpoint URL hostname+port */
  private deriveServiceId(discovery: ServiceDiscovery): string {
    try {
      const url = new URL(discovery.ws_endpoint);
      return url.port ? `svc-${url.port}` : `svc-${url.hostname}`;
    } catch (err) {
      return `svc-${Date.now()}`;
    }
  }

  private emitStatus(service: string, status: ServiceStatus): void {
    if (!this.disposed) {
      this.emitter.fire({ service, status });
    }
  }
}
