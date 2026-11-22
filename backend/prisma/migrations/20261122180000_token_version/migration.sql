-- Logging out other devices: every login token carries this number, and
-- changing or resetting the password raises it, so older tokens stop working.
ALTER TABLE "public"."User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
