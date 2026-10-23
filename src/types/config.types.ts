/**
 * Configuration-related type definitions
 */

import type { LocalServer, RemoteServer } from "./server.types.js";

/** Main application configuration */
export interface AppConfig {
  /** Local STDIO-based servers */
  servers: LocalServer[];
  /** Remote HTTP/SSE-based servers */
  remoteServers: RemoteServer[];
  /** Gateway port */
  port: number;
}

/** Behavior hints sent by MCP servers (all optional, self-reported) */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

/** Tool data with token information */
export interface ToolData {
  tokens: number;
  description?: string;
  annotations?: ToolAnnotations;
}

/** Tool filter for a single server */
export interface ServerToolFilter {
  /** List of disabled tool names (tools to exclude) */
  disabledTools?: string[];
  /** List of all discovered tool names */
  allTools?: string[];
  /** Per-tool data (tokens, etc.) */
  toolsData?: Record<string, ToolData>;
  /** Total tokens for all enabled tools */
  totalTokens?: number;
  /** Last error encountered while testing this server */
  error?: string;
}

/** Tool filters for all servers (keyed by server ID or "remote:serverId") */
export type ToolFilters = Record<string, ServerToolFilter>;

/** Selection state for saving/loading */
export interface SelectionState {
  /** Selected local server IDs */
  local: string[];
  /** Selected remote server IDs */
  remote: string[];
}

/** Configuration paths */
export interface ConfigPaths {
  /** Base config directory */
  configDir: string;
  /** Main config file path */
  configPath: string;
  /** Tool filters file path */
  toolFiltersPath: string;
  /** Selection state file path */
  selectionStatePath: string;
  /** Settings file path */
  settingsPath: string;
  /** Profiles file path */
  profilesPath: string;
  /** Clients state file path */
  clientsStatePath: string;
}

/** Navigation section */
export type NavigationSection = "local" | "remote";

/** Navigation state */
export interface NavigationState {
  /** Current selected index */
  currentIndex: number;
  /** Current section (local or remote) */
  currentSection: NavigationSection;
  /** Selected local server indexes */
  selectedLocalIndexes: Set<number>;
  /** Selected remote server indexes */
  selectedRemoteIndexes: Set<number>;
}
