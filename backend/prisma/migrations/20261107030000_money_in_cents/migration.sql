-- Store money as exact whole numbers instead of decimals (no rounding errors).
-- Existing transfers are converted, not deleted.

-- CAD amounts: dollars -> cents
ALTER TABLE "public"."Transaction" ADD COLUMN "cadAmountCents" INTEGER;
ALTER TABLE "public"."Transaction" ADD COLUMN "feeCents" INTEGER;
UPDATE "public"."Transaction" SET "cadAmountCents" = ROUND("cadAmount" * 100), "feeCents" = ROUND("fee" * 100);
ALTER TABLE "public"."Transaction" ALTER COLUMN "cadAmountCents" SET NOT NULL;
ALTER TABLE "public"."Transaction" ALTER COLUMN "feeCents" SET NOT NULL;
ALTER TABLE "public"."Transaction" DROP COLUMN "cadAmount";
ALTER TABLE "public"."Transaction" DROP COLUMN "fee";

-- UGX amounts: shillings have no smaller unit, so whole numbers
ALTER TABLE "public"."Transaction" ALTER COLUMN "ugxAmount" SET DATA TYPE INTEGER USING FLOOR("ugxAmount")::INTEGER;
