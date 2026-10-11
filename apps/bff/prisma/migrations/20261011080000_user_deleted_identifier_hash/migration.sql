-- Keyed-hash fingerprint of a deleted account's phone/email, written at deletion time so a new
-- signup can be checked against every phone/email that has ever belonged to a deleted account,
-- without retaining the raw value. See AccountDeletionService and AuthService.
ALTER TABLE "User" ADD COLUMN "deletedPhoneHash" TEXT;
ALTER TABLE "User" ADD COLUMN "deletedEmailHash" TEXT;

CREATE INDEX "User_deletedPhoneHash_idx" ON "User"("deletedPhoneHash");
CREATE INDEX "User_deletedEmailHash_idx" ON "User"("deletedEmailHash");
