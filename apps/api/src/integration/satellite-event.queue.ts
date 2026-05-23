/** BullMQ queue consumed by finance-core for cross-satellite accounting jobs. */
export const ERA_SATELLITE_EVENTS_QUEUE = "era-satellite-events";

/** Raw job payload enqueued by era-365-orchestrator satellite-events ingress. */
export type SatelliteEventJobPayload = Record<string, unknown>;
