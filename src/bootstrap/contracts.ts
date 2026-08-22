export type SupportedAgent = "codex" | "claude" | "gemini" | "opencode";
export type PhysicalTargetKind = "agents-shared" | "claude";

export interface AgentAvailability {
  agent: SupportedAgent;
  executable: string | null;
}

export interface BootstrapTarget {
  kind: PhysicalTargetKind;
  path: string;
  agents: readonly SupportedAgent[];
}

export interface HostEnvironment {
  homeDir: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
}

export interface LegoraInstallManifest {
  schemaVersion: 1;
  packageVersion: string;
  payloadDigest: string;
  files: ReadonlyArray<{ relativePath: string; sha256: string }>;
}

export type ManagedCopyState = "ABSENT" | "NO_CHANGE" | "MANAGED_UPDATE" | "CONFLICT";

export interface ManagedCopyInspection {
  state: ManagedCopyState;
  reason:
    | "TARGET_ABSENT"
    | "CURRENT_MANAGED_COPY"
    | "PACKAGED_PAYLOAD_CHANGED"
    | "UNOWNED_TARGET"
    | "MANIFEST_INVALID"
    | "MANAGED_FILE_MODIFIED"
    | "MANAGED_FILE_MISSING"
    | "TARGET_NOT_DIRECTORY";
}

export interface BootstrapFileOps {
  lstat(path: string): Promise<import("node:fs").Stats>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  readdir(path: string, options: { withFileTypes: true }): Promise<import("node:fs").Dirent[]>;
  rename(from: string, to: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
}

export interface ManagedCopyPublication {
  changed: boolean;
  target: string;
  rollback(): Promise<void>;
  finalize(): Promise<void>;
}
