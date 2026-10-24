import { getConfigService } from "./config.service.js";
import { getSettingsService } from "./settings.service.js";
import { getDaemonService } from "./daemon.service.js";
import { getClientStrategy, getRegisteredClientIds } from "./clients/index.js";
import { ProjectConnectionsService } from "./project-connections.service.js";
import { validatePort } from "../shared/validators.js";
import type { ClientId, OperationResult, Platform } from "../types/index.js";

export async function changeGatewayPort(port: number) {
  const warnings: string[] = [];
  const validation = validatePort(port);
  if (!validation.valid)
    return { success: false, error: validation.error, warnings } satisfies OperationResult;

  const configService = getConfigService();
  const previousPort = configService.getPort();
  const daemonService = getDaemonService();
  const running = daemonService.isDaemonRunning(previousPort).running;
  try {
    const result = configService.setPort(port);
    if (!result.success) return { ...result, warnings };
  } catch (error) {
    configService.getConfig().port = previousPort;
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
  try {
    const result = getSettingsService().set("port", port);
    if (!result.success) warnings.push(result.error || "Could not save the port in settings");
  } catch (error) {
    warnings.push(
      `Port saved, but settings could not be updated: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const targets: { clientId: ClientId; projectDir?: string }[] = getRegisteredClientIds().map(
    (clientId) => ({ clientId })
  );
  try {
    targets.push(...new ProjectConnectionsService().list());
  } catch (error) {
    warnings.push(
      `${error instanceof Error ? error.message : String(error)}. Project gateways could not be updated.`
    );
  }
  for (const { clientId, projectDir } of targets) {
    const strategy = getClientStrategy(clientId, projectDir);
    const configPath = strategy?.getEffectiveConfigPath(process.platform as Platform);
    if (!strategy || !configPath) continue;
    try {
      let config = strategy.readConfigForUpdate();
      if (!config) {
        if (projectDir)
          warnings.push(
            `${configPath}: config is missing. Reconnect ${clientId} in ${projectDir} when it is available.`
          );
        continue;
      }
      const keys = strategy.getGatewayKeys(config);
      if (keys.length === 0) continue;
      for (const key of keys) {
        config = strategy.addGateway(config, port, key === "mcpsm" ? undefined : key.slice(6));
      }
      if (!strategy.writeConfig(config)) throw new Error("Failed to write config");
    } catch (error) {
      warnings.push(
        `${configPath}: ${error instanceof Error ? error.message : String(error)}. Reconnect ${clientId}${projectDir ? ` in ${projectDir}` : " globally"} to update its gateway port.`
      );
    }
  }
  if (running) {
    try {
      const result = await daemonService.refreshDaemon(previousPort);
      if (!result.success)
        warnings.push(
          `Port saved, but the daemon could not refresh: ${result.error}. Restart the daemon.`
        );
    } catch (error) {
      warnings.push(
        `Port saved, but the daemon could not refresh: ${error instanceof Error ? error.message : String(error)}. Restart the daemon.`
      );
    }
  }
  return { success: true, warnings } satisfies OperationResult;
}
