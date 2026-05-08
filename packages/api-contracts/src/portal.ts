import { z } from "zod";
import { ModuleEntitlementKeySchema } from "./subscription";

export const PortalFlowDescriptorSchema = z.object({
  id: z.string(),
  titleKey: z.string(),
  entitlement: ModuleEntitlementKeySchema,
});

export const PortalDescriptorSchema = z.object({
  id: z.enum(["etaxes", "emas"]),
  flows: z.array(PortalFlowDescriptorSchema),
});

export type PortalFlowDescriptor = z.infer<typeof PortalFlowDescriptorSchema>;
export type PortalDescriptor = z.infer<typeof PortalDescriptorSchema>;

export const TelemetryEventSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  code: z.string(),
  message: z.string().optional(),
  organizationId: z.string().optional(),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
