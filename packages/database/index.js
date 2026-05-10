"use strict";

const client = require("@prisma/client");
const { Prisma } = client;
const chartSeed = require("./dist/lib/chart/chart-seed.js");
const pricingModuleSeed = require("./dist/lib/core/pricing-module-seed.js");
const legalFormKind = require("./dist/lib/org/legal-form-kind.mapper.js");

Object.assign(module.exports, client, chartSeed, pricingModuleSeed, legalFormKind);
module.exports.Decimal = Prisma.Decimal;
