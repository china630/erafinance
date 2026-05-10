export type SeedCliOptions = {
  layers: string[];
  skip: Set<string>;
  only?: string;
  region?: string;
  dryRun: boolean;
};

function readValue(args: string[], key: string): string | undefined {
  const pref = `${key}=`;
  const inline = args.find((a) => a.startsWith(pref));
  if (inline) return inline.slice(pref.length);
  const idx = args.findIndex((a) => a === key);
  if (idx >= 0) return args[idx + 1];
  return undefined;
}

export function parseSeedCli(args: string[]): SeedCliOptions {
  const layersRaw = readValue(args, "--layers");
  const skipRaw = readValue(args, "--skip");
  const only = readValue(args, "--only");
  const region = readValue(args, "--region");
  const dryRun = args.includes("--dry-run");
  return {
    layers: layersRaw
      ? layersRaw.split(",").map((x) => x.trim()).filter(Boolean)
      : ["core", "national", "hr", "bank", "geo", "trade"],
    skip: new Set(
      (skipRaw ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
    only: only?.trim() || undefined,
    region: region?.trim() || undefined,
    dryRun,
  };
}
