/**
 * Main types export file
 * Re-exports all type definitions for easy importing
 */

// Server types
export type {
  TransportType,
  ServerType,
  OAuthConfig,
  StoredOAuthTokens,
  BaseServer,
  LocalServer,
  RemoteServer,
  Server,
  ServerTestResult,
  ServerWithStatus,
} from "./server.types.js";
export { isLocalServer, isRemoteServer } from "./server.types.js";

// Config types
export type {
  AppConfig,
  ToolAnnotations,
  ToolData,
  ServerToolFilter,
  ToolFilters,
  SelectionState,
  ConfigPaths,
  NavigationSection,
  NavigationState,
} from "./config.types.js";

// Client types
export type {
  ClientId,
  Platform,
  ClientPaths,
  ClientPathsConfig,
  ClientNames,
  DetectedClient,
  ClientStatus,
  ClientServerConfig,
  ClientMcpConfig,
  OperationResult,
} from "./client.types.js";

// Client strategy types
export type {
  ConfigFormat,
  GatewayType,
  ClientCapabilities,
  ClientPlatformPaths,
  ClientMetadata,
  IClientStrategy,
} from "./client-strategy.types.js";

// Profile types
export type {
  Profile,
  ProfilesConfig,
  ProfileListItem,
  ProfileResult,
  ProfileServers,
} from "./profile.types.js";

// Settings types
export type {
  Settings,
  ThemeOption,
  SettingType,
  SettingInfo,
  SettingsInfo,
  SettingResult,
} from "./settings.types.js";

// Tool types
export type {
  Tool,
  ToolWithState,
  ToolDiscoveryResult,
  ToolFilterResult,
  FindServerResult,
  ServerToolsSummary,
  ToolsOutput,
} from "./tool.types.js";

// Auth types
export type {
  TokenResponse,
  AuthServerMetadata,
  ProtectedResourceMetadata,
  PKCEData,
  ClientRegistrationRequest,
  ClientRegistration,
  PendingAuthorization,
  AuthStatus,
  AuthResult,
  OAuthCallbackResult,
  ServerAuthRequirements,
} from "./auth.types.js";

// Daemon types
export type {
  DaemonStatus,
  DaemonInfo,
  DaemonStartOptions,
  DaemonLogsOptions,
  StartupStatus,
  DaemonResult,
  LogEntry,
} from "./daemon.types.js";

// Import/Export types
export type {
  ExportFormat,
  ImportSource,
  McpsmExport,
  ClaudeExport,
  ExportOptions,
  ImportOptions,
  ImportResult,
  ExportResult,
  ImportPreviewItem,
  ImportPreview,
  ConflictResolution,
  FieldDifference,
  ServerConflict,
  ConflictsDetectionResult,
  ConflictDecision,
  MergeResults,
  ImportedServer,
} from "./import-export.types.js";

// Common types
export type {
  Result,
  AsyncResult,
  CliOptions,
  JsonOutputOptions,
  ForceOptions,
  PaginationOptions,
  SortOptions,
  FilterOptions,
  ListOptions,
  KeyValue,
  NamedItem,
  DescribedItem,
  VoidCallback,
  AsyncVoidCallback,
  DataCallback,
  AsyncDataCallback,
  EventHandler,
  CleanupFunction,
} from "./common.types.js";
