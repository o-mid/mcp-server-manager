/**
 * Windsurf Strategy - Strategy for Windsurf IDE
 * Supports real-time config reloading via secondary config path
 */

import path from "path";
import { JsonClientStrategy } from "./json-client.strategy.js";
import type {
  ClientMetadata,
  ClientCapabilities,
  ClientPlatformPaths,
} from "../../types/client-strategy.types.js";

export class WindsurfStrategy extends JsonClientStrategy {
  readonly metadata: ClientMetadata = {
    id: "windsurf",
    displayName: "Windsurf",
    description: "AI-powered code editor by Codeium",
  };

  readonly capabilities: ClientCapabilities = {
    supportsRealTimeReload: true,
    hasSecondaryConfigPath: true,
    configFormat: "json",
    gatewayType: "stdio",
  };

  readonly paths: ClientPlatformPaths = {
    executable: "windsurf",
    primary: {
      darwin: path.join(
        this.getHomedir(),
        "Library/Application Support/Windsurf/User/globalStorage/windsurf.mcp/config.json"
      ),
      win32: path.join(this.getAppData(), "Windsurf/User/globalStorage/windsurf.mcp/config.json"),
      linux: path.join(
        this.getHomedir(),
        ".config/Windsurf/User/globalStorage/windsurf.mcp/config.json"
      ),
    },
    secondary: path.join(this.getHomedir(), ".codeium/windsurf/mcp_config.json"),
    appBundles: {
      darwin: "/Applications/Windsurf.app",
    },
  };
}
