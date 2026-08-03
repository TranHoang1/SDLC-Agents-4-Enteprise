/**
 * SA4E-85 — IPC Bridge Interface.
 * Defines the contract for WebSocket-based IPC communication
 * with discovered local services (Kiro, AntiGravity).
 * Implements BR-13 (exponential backoff) and BR-14 (localhost-only).
 */

import type { Event } from 'vscode';

/** Service discovery payload from .code-intel/.run/{service}.json */
export interface ServiceDiscovery {
  ws_endpoint: string;
  rest_endpoint: string;
  pid: number;
  status: string;
  version: string;
  started_at: string;
}

/** Connection status for an IPC service */
export type ServiceStatus = 'connected' | 'connecting' | 'disconnected' | 'offline';

/** Status change event payload */
export interface StatusChangeEvent {
  service: string;
  status: ServiceStatus;
}

/**
 * IPC Bridge — manages WebSocket connections to local services.
 * Supports dual connections (Kiro + AntiGravity simultaneously).
 * Must be pushed into ExtensionContext.subscriptions for cleanup.
 */
export interface IIpcBridge {
  /** Connect to a discovered service endpoint */
  connect(service: ServiceDiscovery): Promise<void>;
  /** Disconnect a specific service by ID */
  disconnect(serviceId: string): void;
  /** Send a JSON-RPC 2.0 call and await the response */
  call(serviceId: string, method: string, params: unknown): Promise<unknown>;
  /** Get current status for all tracked services */
  getStatus(): Map<string, ServiceStatus>;
  /** Event fired when any service connection status changes */
  onStatusChanged: Event<StatusChangeEvent>;
  /** Dispose all connections and cleanup resources */
  dispose(): void;
}
