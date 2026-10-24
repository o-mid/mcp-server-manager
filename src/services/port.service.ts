import { getConfigService } from "./config.service.js";
import { getClientService } from "./client.service.js";
import { getDaemonService, type DaemonStatus } from "./daemon.service.js";
import { validatePort } from "../shared/validators.js";
import type { ClientId } from "../types/index.js";

export interface PortUpdateResult {
  success: boolean;
  port: number;
  error?: string;
  clientErrors: Array<{ clientId: ClientId; error: string }>;
  daemonError?: string;
}

let portUpdateQueue: Promise<unknown> = Promise.resolve();

async function refreshDaemonForPortChange(status: DaemonStatus, portChanged: boolean) {
  if (!status.running) return { success: true };

  const daemon = getDaemonService();
  if (!portChanged) {
    const health = await daemon.checkHealth();
    if (health.status === "ok") return { success: true };
  }
  return daemon.refreshDaemon(status, true);
}

async function applyGatewayPort(port: number) {
  const config = getConfigService();
  const previousPort = config.getPort();
  const result: PortUpdateResult = { success: false, port: previousPort, clientErrors: [] };
  const validation = validatePort(port);
  if (!validation.valid) {
    result.error = validation.error;
    return result;
  }

  const status = getDaemonService().getPortUpdateStatus();
  try {
    const saved = config.setPort(port);
    if (!saved.success) {
      result.error = saved.error;
      return result;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }

  result.port = port;
  result.clientErrors = getClientService().updateConnectedGatewayPorts(port);
  const errors = result.clientErrors.map((failure) => failure.clientId + ": " + failure.error);

  try {
    const refresh = await refreshDaemonForPortChange(status, previousPort !== port);
    if (!refresh.success)
      result.daemonError = refresh.error || "Daemon readiness was not confirmed";
  } catch (error) {
    result.daemonError = error instanceof Error ? error.message : String(error);
  }

  if (result.daemonError) errors.push(result.daemonError);
  result.success = errors.length === 0;
  result.error = errors.join("; ") || undefined;
  return result;
}

export function updateGatewayPort(port: number) {
  const update = portUpdateQueue.then(() => applyGatewayPort(port));
  portUpdateQueue = update.catch(() => undefined);
  return update;
}
