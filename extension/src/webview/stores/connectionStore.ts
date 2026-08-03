/**
 * SA4E-85 — Connection Store.
 * Tracks connection status for external services (Kiro, AntiGravity).
 * Updated via IPC_STATUS messages from Extension Host IpcBridge.
 */

import { writable, derived } from 'svelte/store';
import type { ServiceStatus } from '../../chat/types';

/** Service connection entry with endpoint info */
export interface ServiceConnection {
  service: string;
  status: ServiceStatus;
  endpoint?: string;
  lastUpdated: number;
}

/** Internal state for connection tracking */
interface ConnectionState {
  services: Map<string, ServiceConnection>;
}

const initialState: ConnectionState = {
  services: new Map(),
};

/** Core writable store for connection state */
export const connectionState = writable<ConnectionState>(initialState);

/** Derived: all services as array */
export const servicesList = derived(connectionState, ($s) =>
  Array.from($s.services.values())
);

/** Derived: true if any service is connected */
export const hasActiveConnection = derived(connectionState, ($s) => {
  for (const svc of $s.services.values()) {
    if (svc.status === 'connected') return true;
  }
  return false;
});

/** Derived: true if all services are offline/disconnected */
export const allDisconnected = derived(connectionState, ($s) => {
  if ($s.services.size === 0) return true;
  for (const svc of $s.services.values()) {
    if (svc.status === 'connected' || svc.status === 'connecting') return false;
  }
  return true;
});

/** Update a service connection status from IPC_STATUS message */
export function updateServiceStatus(
  service: string,
  status: ServiceStatus,
  endpoint?: string
): void {
  connectionState.update((s) => {
    const next = new Map(s.services);
    next.set(service, { service, status, endpoint, lastUpdated: Date.now() });
    return { services: next };
  });
}

/** Remove a service entry (e.g., on discovery file deletion) */
export function removeService(service: string): void {
  connectionState.update((s) => {
    const next = new Map(s.services);
    next.delete(service);
    return { services: next };
  });
}

/** Reset all connection state */
export function resetConnections(): void {
  connectionState.set(initialState);
}
