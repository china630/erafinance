import { AsyncLocalStorage } from "node:async_hooks";

/** Current HTTP actor (JWT user) for audit-style fields e.g. soft-delete `deletedByUserId`. */
export type ActorContextStore = {
  userId: string | null;
};

export const actorContextStorage = new AsyncLocalStorage<ActorContextStore>();

export function getActorContext(): ActorContextStore | undefined {
  return actorContextStorage.getStore();
}

export function getActorUserId(): string | null {
  return getActorContext()?.userId ?? null;
}

export function runWithActorContext<T>(store: ActorContextStore, fn: () => T): T {
  return actorContextStorage.run(store, fn);
}

export async function runWithActorContextAsync<T>(
  store: ActorContextStore,
  fn: () => Promise<T>,
): Promise<T> {
  return actorContextStorage.run(store, fn);
}
