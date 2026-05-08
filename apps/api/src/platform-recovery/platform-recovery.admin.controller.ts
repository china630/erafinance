import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../auth/guards/super-admin.guard";
import { SnapshotService } from "./snapshot/snapshot.service";
import { RollbackService } from "./rollback/rollback.service";
import { StepUpGuard } from "./step-up/step-up.guard";
import { RequiresStepUp } from "./step-up/requires-step-up.decorator";
import { STEP_UP_PURPOSE_SNAPSHOT_MANUAL } from "./step-up/step-up.constants";

@ApiTags("admin-platform-recovery")
@ApiBearerAuth("bearer")
@Controller("admin/organizations")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlatformRecoveryAdminController {
  constructor(
    private readonly snapshots: SnapshotService,
    private readonly rollback: RollbackService,
  ) {}

  @Get(":organizationId/snapshots")
  listSnapshots(@Param("organizationId") organizationId: string) {
    return this.snapshots.listSnapshots(organizationId);
  }

  @Post(":organizationId/snapshots/manual")
  @UseGuards(StepUpGuard)
  @RequiresStepUp(STEP_UP_PURPOSE_SNAPSHOT_MANUAL)
  takeSnapshot(@Param("organizationId") organizationId: string) {
    return this.snapshots.takeSnapshot(organizationId, "manual", null);
  }

  @Get(":organizationId/snapshots/:snapshotId/preview-restore")
  preview(@Param("organizationId") organizationId: string, @Param("snapshotId") snapshotId: string) {
    return this.rollback.previewRestore(organizationId, snapshotId);
  }
}
