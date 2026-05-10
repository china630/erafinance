export function resolveRegion(argvRegion?: string): string {
  return (argvRegion ?? process.env.SEED_REGION ?? "AZ").trim().toUpperCase();
}
