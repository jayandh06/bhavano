-- Carries two things the Razorpay webhook cannot see for itself, captured when the order is
-- created: whether the buyer's device allowed ad tracking (ATT), and which client they bought
-- from. Both nullable — every existing row predates the question, and null means "not stated",
-- which the upload treats as authorized/web respectively.
ALTER TABLE "Payment" ADD COLUMN     "adsTrackingAuthorized" BOOLEAN,
ADD COLUMN     "platform" TEXT;
