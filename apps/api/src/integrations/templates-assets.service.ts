import { Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";

@Injectable()
export class TemplatesAssetsService {
  getTemplateStream(portal: "dvx" | "emas" | "customs", name: string): StreamableFile {
    const candidates = [
      join(__dirname, "templates", portal, name),
      join(__dirname, "..", "integrations", "templates", portal, name),
      join(process.cwd(), "apps", "api", "src", "integrations", "templates", portal, name),
    ];
    const fullPath = candidates.find((p) => existsSync(p));
    if (!fullPath) {
      throw new NotFoundException(`Template not found: ${portal}/${name}`);
    }
    return new StreamableFile(createReadStream(fullPath));
  }
}
