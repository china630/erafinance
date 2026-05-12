import { defineConfig } from "wxt";

// See apps/extension/README.md — stable unpacked id in dev (optional `key` in manifest).
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "ERA Finance Assistant",
    description:
      "ERA Finance helper for government portals (ƏMAS, e-taxes, e-customs) — explicit user actions only.",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApJ0Luhfq3ZIR5fekavvTFZwwRV83hqhZWjnk/arZjFpTMK/KB5PBsK62A36f+QU4P5OdvsLnxp/EQ6u3duhJEINr04yOJxrt2+jopW2n5NU+LuSyR9ADy3JPfYRQEQcI/oPJNnbNkrfqVkCc4HcYqqZdm4CzR2Jl0UtRYwznKP/ryUn8THRXReKN+iOOJcdy3pxFhZxzFEb1FPaZMaj3mKSVdmZViogpV0qAfYn6iTjSafYnnYgX95u4GzRk9ISt8Ts/4zw/V3AV90TJwJXqrkyPD1uw62CeM9PLpRksN01M+NxKqseEQlMxKD7ZRZYSbc1lNzNQ1eCuyqBbdMX9YQIDAQAB",
    permissions: ["storage", "alarms", "tabs", "scripting"],
    host_permissions: [
      "http://127.0.0.1:4000/*",
      "http://localhost:4000/*",
      "http://localhost:3000/*",
      "http://127.0.0.1:3000/*",
      "https://api.example.com/*",
      "https://erp.example.com/*",
      "https://*.e-taxes.gov.az/*",
      "https://new.e-taxes.gov.az/*",
      "https://login.e-taxes.gov.az/*",
      "https://emas.sosial.gov.az/*",
      "https://e-customs.gov.az/*",
      "https://*.customs.gov.az/*",
    ],
    externally_connectable: {
      matches: [
        "https://erp.example.com/*",
        "http://localhost:3000/*",
        "http://127.0.0.1:3000/*",
      ],
    },
  },
});
