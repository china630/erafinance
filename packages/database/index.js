"use strict";

const client = require("@prisma/client");
const { Prisma } = client;
const chartSeed = require("./dist/lib/chart/chart-seed.js");
const pricingModuleKeys = require("./dist/lib/core/pricing-module-keys.js");
const pricingModuleSeed = require("./dist/lib/core/pricing-module-seed.js");
const pricingBundleSeed = require("./dist/lib/core/pricing-bundle-seed.js");
const ensureCurrenciesSeed = require("./dist/lib/core/ensure-currencies-seed.js");
const legalFormKind = require("./dist/lib/org/legal-form-kind.mapper.js");

Object.assign(
  module.exports,
  client,
  chartSeed,
  pricingModuleKeys,
  pricingModuleSeed,
  pricingBundleSeed,
  ensureCurrenciesSeed,
  legalFormKind,
);
module.exports.Decimal = Prisma.Decimal;
