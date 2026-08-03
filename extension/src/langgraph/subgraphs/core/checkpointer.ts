/**
 * Re-export RemoteCheckpointer from the canonical location for subgraph imports.
 * [v3.1] WorkspaceCheckpointer removed — persistence now goes to Backend KB.
 */
export { RemoteCheckpointer } from "../../core/remote-checkpointer";
