import fs from "fs";
import path from "path";
import { getConfigService } from "./config.service.js";
import { getClientStrategy, getRegisteredClientIds } from "./clients/index.js";
import { writePrivateJsonFile } from "../shared/secure-storage.js";
import type { ClientId } from "../types/index.js";

export class ProjectConnectionsService {
  private get filePath() {
    return getConfigService().getPaths().clientsStatePath;
  }

  private read() {
    const projectConnections: { projectDir: string; clientId: ClientId }[] = [];
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return { projectConnections };
      }
      throw new Error(`Could not read project connections from ${this.filePath}`, { cause: error });
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Invalid project connections in ${this.filePath}`);
    }
    const entries = "projectConnections" in data ? data.projectConnections : [];
    if (!Array.isArray(entries)) throw new Error(`Invalid project connections in ${this.filePath}`);
    for (const entry of entries) {
      if (!entry || typeof entry !== "object")
        throw new Error(`Invalid project connection in ${this.filePath}`);
      const clientId = getRegisteredClientIds().find((id) => id === entry.clientId);
      if (
        !clientId ||
        !getClientStrategy(clientId)?.paths.project ||
        typeof entry.projectDir !== "string" ||
        !path.isAbsolute(entry.projectDir)
      ) {
        throw new Error(`Invalid project connection in ${this.filePath}`);
      }
      const projectDir = path.resolve(entry.projectDir);
      if (
        !projectConnections.some(
          (item) => item.clientId === clientId && item.projectDir === projectDir
        )
      ) {
        projectConnections.push({ projectDir, clientId });
      }
    }
    return { ...data, projectConnections };
  }

  list() {
    return this.read().projectConnections;
  }

  register(projectDir: string, clientId: ClientId) {
    const data = this.read();
    if (
      data.projectConnections.some(
        (item) => item.projectDir === projectDir && item.clientId === clientId
      )
    )
      return;
    data.projectConnections.push({ projectDir, clientId });
    writePrivateJsonFile(this.filePath, data);
  }

  unregister(projectDir: string, clientId: ClientId) {
    const data = this.read();
    const remaining = data.projectConnections.filter(
      (item) => item.projectDir !== projectDir || item.clientId !== clientId
    );
    if (remaining.length === data.projectConnections.length) return;
    writePrivateJsonFile(this.filePath, { ...data, projectConnections: remaining });
  }
}
