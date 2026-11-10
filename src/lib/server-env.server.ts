type ServerBindings = Record<string, unknown>;

type ServerBindingsStorage = {
  getStore: () => ServerBindings | undefined;
  run: <T>(store: ServerBindings, callback: () => T) => T;
};

const storageKey = Symbol.for("dukaansaathi.server-bindings-storage");

function getStorage(): ServerBindingsStorage | undefined {
  const storage = (globalThis as Record<symbol, unknown>)[storageKey];
  if (
    storage &&
    typeof storage === "object" &&
    "getStore" in storage &&
    "run" in storage &&
    typeof storage.getStore === "function" &&
    typeof storage.run === "function"
  ) {
    return storage as ServerBindingsStorage;
  }
  return undefined;
}

export function installServerBindingsStorage(storage: ServerBindingsStorage): void {
  (globalThis as Record<symbol, unknown>)[storageKey] = storage;
}

function isServerBindings(value: unknown): value is ServerBindings {
  return value !== null && typeof value === "object";
}

export function withServerBindings<T>(bindings: unknown, callback: () => T): T {
  const storage = getStorage();
  if (storage) return storage.run(isServerBindings(bindings) ? bindings : {}, callback);
  return callback();
}

export function getServerEnv(name: string): string | undefined {
  const processValue = typeof process === "undefined" ? undefined : process.env[name];
  if (processValue?.trim()) return processValue;

  const bindingValue = getStorage()?.getStore()?.[name];
  return typeof bindingValue === "string" && bindingValue.trim() ? bindingValue : undefined;
}
