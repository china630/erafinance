-- Prepaid outbound WhatsApp message balance per organization (PRD §6.8 / §7.12.3).
ALTER TABLE "organizations"
ADD COLUMN "whatsapp_outbound_messages_balance" INTEGER NOT NULL DEFAULT 0;
