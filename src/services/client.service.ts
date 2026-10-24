/**
 * Client service - manages MCP client detection and sync
 * Facade pattern - delegates all client-specific logic to strategy implementations
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import type {
  ClientId,
  Platform,
  DetectedClient,
  ClientStatus,
  ClientMcpConfig,
  OperationResult,
} from "../types/index.js";
import { getConfigService } from "./config.service.js";
import { ProjectConnectionsService } from "./project-connections.service.js";
import { getProfileService } from "./profile.service.js";
import { getClientStrategy, getRegisteredClientIds, clearStrategyCache } from "./clients/index.js";

/** Client service class */
export class ClientService {
  constructor(private readonly projectDir?: string) {
    if (projectDir) this.projectDir = path.resolve(projectDir);
  }

  private getStrategy(clientId: ClientId) {
    return getClientStrategy(clientId, this.projectDir);
  }

  supportsProjectConfig(clientId: ClientId) {
    return !!this.getStrategy(clientId)?.paths.project;
  }
  private updateProjectRegistration(clientId: ClientId, result: OperationResult) {
    if (!this.projectDir || !result.success) return result;
    try {
      const strategy = this.getStrategy(clientId);
      const config = strategy?.readConfigForUpdate();
      const registry = new ProjectConnectionsService();
      if (strategy && config && strategy.getGatewayKeys(config).length > 0) {
        registry.register(this.projectDir, clientId);
      } else {
        registry.unregister(this.projectDir, clientId);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...result,
        warnings: [
          ...(result.warnings || []),
          `${message}. Reconnect ${clientId} in ${this.projectDir} to retry project tracking.`,
        ],
      };
    }
  }

  /** Get current platform */
  private getPlatform(): Platform {
    return process.platform as Platform;
  }

  /** Get config path for a client on current platform */
  getClientConfigPath(clientId: ClientId): string | null {
    const strategy = this.getStrategy(clientId);
    return strategy?.getPrimaryConfigPath(this.getPlatform()) || null;
  }

  /** Get client display name */
  getClientName(clientId: ClientId): string {
    const strategy = this.getStrategy(clientId);
    return strategy?.metadata.displayName || clientId;
  }

  /** Get all supported client IDs */
  getSupportedClients(): ClientId[] {
    return getRegisteredClientIds();
  }

  /** Check if a client is installed */
  isClientInstalled(clientId: ClientId): boolean {
    const strategy = this.getStrategy(clientId);
    return strategy?.isInstalled(this.getPlatform()) || false;
  }

  /** Read client's current config */
  readClientConfig(clientId: ClientId): ClientMcpConfig | null {
    const strategy = this.getStrategy(clientId);
    return strategy?.readConfig() || null;
  }

  /** Write client's config */
  writeClientConfig(clientId: ClientId, config: ClientMcpConfig): boolean {
    const strategy = this.getStrategy(clientId);
    return strategy?.writeConfig(config) || false;
  }

  /** Detect all installed clients */
  detectClients(profileId?: string): DetectedClient[] {
    const platform = this.getPlatform();
    const clients: DetectedClient[] = [];

    for (const clientId of this.getSupportedClients()) {
      const strategy = this.getStrategy(clientId);
      if (!strategy || (this.projectDir && !strategy.paths.project)) continue;

      const installed = strategy.isInstalled(platform);
      const status = strategy.getStatus(platform, profileId);
      const serverCount = strategy.getServerCount();

      clients.push({
        id: clientId,
        name: strategy.metadata.displayName,
        configPath: strategy.getPrimaryConfigPath(platform),
        mcpConfigPath: strategy.getSecondaryConfigPath(),
        installed,
        hasConfig: strategy.readConfig() !== null,
        status,
        serverCount,
      });
    }

    return clients;
  }

  /** Connect servers to a specific client (add mcpsm gateway to client config) */
  connectClient(clientId: ClientId, profileId?: string): OperationResult {
    const strategy = this.getStrategy(clientId);
    if (!strategy) {
      return { success: false, error: "Unknown client" };
    }

    const configService = getConfigService();
    const port = configService.getPort();

    return this.updateProjectRegistration(clientId, strategy.connect(port, profileId));
  }

  /** Disconnect servers from a specific client (remove our servers from client config) */
  disconnectClient(clientId: ClientId, profileId?: string): OperationResult {
    const strategy = this.getStrategy(clientId);
    if (!strategy) {
      return { success: false, error: "Unknown client" };
    }

    return this.updateProjectRegistration(clientId, strategy.disconnect(profileId));
  }

  /** Connect all profiles to a client (one gateway entry per profile) */
  connectAllProfiles(clientId: ClientId): {
    succeeded: string[];
    failed: { id: string; error: string }[];
    warnings?: string[];
  } {
    const strategy = this.getStrategy(clientId);
    if (!strategy) {
      return { succeeded: [], failed: [{ id: "*", error: "Unknown client" }] };
    }

    const configService = getConfigService();
    const port = configService.getPort();
    const profileService = getProfileService();
    const profiles = profileService.list();

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    const warnings: string[] = [];

    for (const profile of profiles) {
      const result = strategy.connect(port, profile.id);
      warnings.push(...(result.warnings || []));
      if (result.success) {
        succeeded.push(profile.id);
      } else {
        failed.push({ id: profile.id, error: result.error || "Unknown error" });
      }
    }

    if (succeeded.length > 0) {
      const registration = this.updateProjectRegistration(clientId, { success: true });
      warnings.push(...(registration.warnings || []));
    }
    return { succeeded, failed, ...(warnings.length > 0 ? { warnings } : {}) };
  }

  /** Disconnect all profiles from a client */
  disconnectAllProfiles(clientId: ClientId): {
    succeeded: string[];
    failed: { id: string; error: string }[];
    warnings?: string[];
  } {
    const strategy = this.getStrategy(clientId);
    if (!strategy) {
      return { succeeded: [], failed: [{ id: "*", error: "Unknown client" }] };
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    try {
      let config = strategy.readConfigForUpdate();
      if (!config) {
        const registration = this.updateProjectRegistration(clientId, { success: true });
        return {
          succeeded,
          failed,
          ...(registration.warnings ? { warnings: registration.warnings } : {}),
        };
      }
      const keys = strategy.getGatewayKeys(config);
      for (const key of keys) {
        config = strategy.removeGateway(config, key === "mcpsm" ? undefined : key.slice(6));
      }
      if (keys.length > 0 && !strategy.writeConfig(config)) {
        return {
          succeeded,
          failed: keys.map((key) => ({
            id: key === "mcpsm" ? "*" : key.slice(6),
            error: "Failed to write config",
          })),
        };
      }
      succeeded.push(...keys.map((key) => (key === "mcpsm" ? "*" : key.slice(6))));
      const registration = this.updateProjectRegistration(clientId, { success: true });
      return {
        succeeded,
        failed,
        ...(registration.warnings ? { warnings: registration.warnings } : {}),
      };
    } catch (error) {
      return {
        succeeded,
        failed: [{ id: "*", error: error instanceof Error ? error.message : String(error) }],
      };
    }
  }

  /** Get connection status for a client */
  getConnectionStatus(clientId: ClientId, profileId?: string): ClientStatus {
    const strategy = this.getStrategy(clientId);
    if (!strategy) {
      return "not-installed";
    }

    return strategy.getStatus(this.getPlatform(), profileId);
  }

  /** Open client config in editor */
  openClientConfig(clientId: ClientId): OperationResult {
    const configPath = this.getClientConfigPath(clientId);
    if (!configPath) {
      return { success: false, error: "Unknown client" };
    }

    if (!fs.existsSync(configPath)) {
      return { success: false, error: "Config file does not exist" };
    }

    const editor = process.env.EDITOR || process.env.VISUAL || "vi";

    try {
      spawnSync(editor, [configPath], { stdio: "inherit" });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error";
      return { success: false, error };
    }
  }

  /** Check if client exists */
  clientExists(clientId: string): clientId is ClientId {
    return this.getStrategy(clientId as ClientId) !== null;
  }
}

/** Singleton instance */
let instance: ClientService | null = null;

/** Get or create the client service instance */
export function getClientService(): ClientService {
  if (!instance) {
    instance = new ClientService();
  }
  return instance;
}

/** Reset the singleton instance (for testing) */
export function resetClientService(): void {
  instance = null;
  clearStrategyCache();
}

export default ClientService;
