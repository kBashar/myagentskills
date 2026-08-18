// Minimal type declarations for the Node.js stdlib surface margin uses.
// ADR-0006: `typescript` is the sole devDependency — no @types/node — so this
// file declares exactly the API surface src/ and test/ touch, nothing more.
// The HTTP-seam tests are the backstop if a declaration here drifts from
// Node's real behavior.

declare class Buffer {
  static from(data: string, encoding?: string): Buffer;
  static concat(chunks: Buffer[]): Buffer;
  readonly length: number;
  toString(encoding?: string): string;
}

declare function setTimeout(callback: (...args: any[]) => void, ms: number): unknown;

declare const __dirname: string;

declare function require(id: string): any;

declare const console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
};

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  pid: number;
  execPath: string;
  cwd(): string;
  exit(code?: number): never;
  kill(pid: number, signal?: string): void;
  once(event: string, listener: (...args: any[]) => void): void;
  stdout: { write(text: string): void };
  stderr: { write(text: string): void };
};

declare class URL {
  constructor(url: string, base?: string);
  pathname: string;
  search: string;
  port: string;
  searchParams: { get(name: string): string | null };
}

declare module 'node:http' {
  export interface IncomingMessage {
    method: string;
    url: string;
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    on(event: string, listener: (...args: any[]) => void): void;
    resume(): void;
  }
  export interface ServerResponse {
    readonly headersSent: boolean;
    readonly writableEnded: boolean;
    writeHead(status: number, headers?: Record<string, string | number>): void;
    end(body?: string | Buffer): void;
  }
  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    removeListener(event: string, listener: (...args: any[]) => void): void;
    address(): { port: number };
    close(callback?: () => void): void;
    closeIdleConnections?(): void;
  }
  export interface RequestOptions {
    host?: string;
    port?: number;
    path?: string;
    method?: string;
    headers?: Record<string, string | number>;
  }
  export interface ClientRequest {
    setTimeout(ms: number, callback?: () => void): void;
    on(event: string, listener: (...args: any[]) => void): void;
    write(data: string | Buffer): void;
    end(): void;
    destroy(error?: Error): void;
  }
  export function createServer(listener: (req: IncomingMessage, res: ServerResponse) => void): Server;
  export function request(options: RequestOptions, callback: (res: IncomingMessage) => void): ClientRequest;
}

declare module 'node:fs' {
  export interface Stats {
    isFile(): boolean;
    mtimeMs: number;
    mode: number;
  }
  export function mkdirSync(path: string, options?: number | { recursive?: boolean; mode?: number }): void;
  export function openSync(path: string, flags: string, mode?: number): number;
  export function closeSync(fd: number): void;
  export function appendFileSync(path: string, data: string, options?: { mode?: number }): void;
  export function readFileSync(path: string): Buffer;
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string | Buffer, options?: { mode?: number }): void;
  export function renameSync(from: string, to: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function statSync(path: string): Stats;
  export function existsSync(path: string): boolean;
  export function mkdtempSync(prefix: string): string;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function basename(path: string): string;
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
}

declare module 'node:crypto' {
  export function randomBytes(size: number): Buffer;
  export function timingSafeEqual(a: Buffer, b: Buffer): boolean;
  export interface Hash {
    update(data: string | Buffer): Hash;
    digest(encoding: string): string;
  }
  export function createHash(algorithm: string): Hash;
}

declare module 'node:child_process' {
  export interface SpawnOptions {
    detached?: boolean;
    stdio?: Array<string | number>;
    env?: Record<string, string | undefined>;
  }
  export interface ChildProcess {
    pid?: number;
    unref(): void;
  }
  export function spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess;
  export interface SpawnSyncOptions {
    env?: Record<string, string | undefined>;
    cwd?: string;
    encoding?: string;
    timeout?: number;
  }
  export interface SpawnSyncResult {
    status: number | null;
    stdout: string;
    stderr: string;
  }
  export function spawnSync(command: string, args: string[], options?: SpawnSyncOptions): SpawnSyncResult;
}

declare module 'node:test' {
  export interface TestContext {
    after(fn: () => void | Promise<void>): void;
  }
  export function test(name: string, fn: (t: TestContext) => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function deepStrictEqual(actual: unknown, expected: unknown, message?: string): void;
  export function match(actual: unknown, regexp: RegExp, message?: string): void;
  export function ok(value: unknown, message?: string): void;
}
