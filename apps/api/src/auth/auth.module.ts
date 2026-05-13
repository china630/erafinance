import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { HrModule } from "../hr/hr.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TeamController } from "./team.controller";
import { UsersController } from "./users.controller";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { PiiCryptoService } from "../security/pii-crypto.service";
import { GlobalCompanyDirectoryModule } from "../global-directory/global-company-directory.module";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [
    PrismaModule,
    ReferralsModule,
    GlobalCompanyDirectoryModule,
    forwardRef(() => OrganizationsModule),
    HrModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: (config.get<string>("JWT_ACCESS_EXPIRES") ?? "12h") as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, TeamController, UsersController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    SuperAdminGuard,
    PiiCryptoService,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, RolesGuard, SuperAdminGuard],
})
export class AuthModule {}
