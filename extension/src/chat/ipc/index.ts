/**
 * SA4E-85 — IPC Bridge barrel export.
 * Public API for the IPC communication module.
 */

export { IpcBridge } from './IpcBridge';
export { JsonRpcClient } from './jsonRpcClient';
export { ServiceDiscoveryWatcher, isLocalhostEndpoint, parseDiscoveryFile, serviceIdFromPath } from './serviceDiscovery';

export type { IIpcBridge, ServiceDiscovery, ServiceStatus, StatusChangeEvent } from './IIpcBridge';
export type { DiscoveryListener } from './serviceDiscovery';
export type { JsonRpcRequest, JsonRpcResponse, JsonRpcError } from './jsonRpcClient';
