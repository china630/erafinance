import { connectionFromRedisUrl } from "./bullmq.config";

describe("connectionFromRedisUrl", () => {
  it("parses redis logical DB from URL path", () => {
    const c = connectionFromRedisUrl("redis://localhost:6379/3") as {
      host: string;
      port: number;
      db?: number;
    };
    expect(c.host).toBe("localhost");
    expect(c.port).toBe(6379);
    expect(c.db).toBe(3);
  });

  it("defaults DB when path absent", () => {
    const c = connectionFromRedisUrl("redis://127.0.0.1:6379") as { db?: number };
    expect(c.db).toBeUndefined();
  });
});
