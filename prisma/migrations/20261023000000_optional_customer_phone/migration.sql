-- Customers created inline on Ghi nhận may have no phone (NULLs do not clash on UNIQUE)
ALTER TABLE "customers" ALTER COLUMN "phone" DROP NOT NULL;
