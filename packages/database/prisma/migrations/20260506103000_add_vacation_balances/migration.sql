-- Vacation accrual (Advanced HRMS): balance, annual norm, employment status

CREATE TYPE "EmployeeEmploymentStatus" AS ENUM ('ACTIVE', 'TERMINATED');

ALTER TABLE "employees" ADD COLUMN "vacation_days_balance" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "base_vacation_days_per_year" INTEGER NOT NULL DEFAULT 21;
ALTER TABLE "employees" ADD COLUMN "employment_status" "EmployeeEmploymentStatus" NOT NULL DEFAULT 'ACTIVE';
