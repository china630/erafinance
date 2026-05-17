import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { OrganizationId } from "../common/org-id.decorator";
import { ReleaseProductionDto } from "./dto/release-production.dto";
import { UpsertRecipeDto } from "./dto/upsert-recipe.dto";
import { ManufacturingService } from "./manufacturing.service";
import { ManufacturingOrderService } from "./manufacturing-order.service";
import { CreateManufacturingOrderDto } from "./dto/create-manufacturing-order.dto";
import { ManufacturingOrderStatus } from "@erafinance/database";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";

@ApiTags("manufacturing")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.MANUFACTURING)
@Controller("manufacturing")
export class ManufacturingController {
  constructor(
    private readonly mfg: ManufacturingService,
    private readonly orders: ManufacturingOrderService,
  ) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Manufacturing hub widgets (recent releases, alerts)" })
  dashboard(@OrganizationId() organizationId: string) {
    return this.mfg.getDashboard(organizationId);
  }

  @Get("recipes")
  @ApiOperation({ summary: "Paginated list of BOM recipes" })
  listRecipes(
    @OrganizationId() organizationId: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
    @Query("q") q?: string,
  ) {
    return this.mfg.listRecipesPaginated(organizationId, { page, pageSize, q });
  }

  @Get("recipes/by-product/:finishedProductId")
  @ApiOperation({ summary: "Recipe by finished product id" })
  getRecipeByProduct(
    @OrganizationId() organizationId: string,
    @Param("finishedProductId") finishedProductId: string,
  ) {
    return this.mfg.getRecipeByFinishedProduct(organizationId, finishedProductId);
  }

  @Get("recipes/:recipeId/available-output")
  @ApiOperation({
    summary:
      "Virtual stock: max whole FG units from current component stock (BOM × wasteFactor)",
  })
  availableOutput(
    @OrganizationId() organizationId: string,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.mfg.computeAvailableOutput(
      organizationId,
      recipeId,
      warehouseId?.trim() ? warehouseId : undefined,
    );
  }

  @Get("recipes/:recipeId")
  @ApiOperation({ summary: "Recipe detail with lines and byproducts" })
  getRecipe(
    @OrganizationId() organizationId: string,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
  ) {
    return this.mfg.getRecipeById(organizationId, recipeId);
  }

  @Put("recipes")
  @ApiOperation({ summary: "Create or replace recipe (transactional)" })
  upsertRecipe(
    @OrganizationId() organizationId: string,
    @Body() dto: UpsertRecipeDto,
  ) {
    return this.mfg.upsertRecipe(organizationId, dto);
  }

  @Delete("recipes/:recipeId")
  @ApiOperation({ summary: "Delete recipe (blocked if releases exist)" })
  deleteRecipe(
    @OrganizationId() organizationId: string,
    @Param("recipeId", new ParseUUIDPipe({ version: "4" })) recipeId: string,
  ) {
    return this.mfg.deleteRecipe(organizationId, recipeId);
  }

  @Get("releases")
  @ApiOperation({ summary: "Production release journal (paginated)" })
  listReleases(
    @OrganizationId() organizationId: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
    @Query("period") period?: string,
    @Query("recipeId") recipeId?: string,
    @Query("warehouseId") warehouseId?: string,
  ) {
    return this.mfg.listReleases(organizationId, {
      page,
      pageSize,
      period,
      recipeId,
      warehouseId,
    });
  }

  @Get("orders")
  @ApiOperation({ summary: "List manufacturing orders (WIP)" })
  listOrders(
    @OrganizationId() organizationId: string,
    @Query("status") status?: ManufacturingOrderStatus,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
  ) {
    return this.orders.listOrders(organizationId, { status, page, pageSize });
  }

  @Post("orders")
  @ApiOperation({ summary: "Create manufacturing order (DRAFT)" })
  createOrder(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateManufacturingOrderDto,
  ) {
    return this.orders.createOrder(organizationId, dto);
  }

  @Post("orders/:id/start")
  @ApiOperation({ summary: "Start order: reserve materials Dr 203 / Cr 201" })
  startOrder(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.orders.startOrder(organizationId, id);
  }

  @Post("orders/:id/complete")
  @ApiOperation({ summary: "Complete order: FG Dr 204 / Cr 203" })
  completeOrder(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.orders.completeOrder(organizationId, id);
  }

  @Post("orders/:id/cancel")
  @ApiOperation({ summary: "Cancel order (reverse WIP if started)" })
  cancelOrder(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.orders.cancelOrder(organizationId, id);
  }

  @Post("release")
  @ApiOperation({
    summary:
      "Release finished goods: component OUT, FG IN, journal Dr 204 / Cr 201",
  })
  release(
    @OrganizationId() organizationId: string,
    @Body() dto: ReleaseProductionDto,
  ) {
    return this.mfg.releaseProduction(organizationId, dto);
  }
}
