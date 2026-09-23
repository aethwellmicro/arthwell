-- CreateTable LoanProduct
CREATE TABLE IF NOT EXISTS "LoanProduct" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loanType" TEXT NOT NULL DEFAULT 'JLG / Group Loan',
    "principal" DECIMAL(65,30) NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "interestBasis" TEXT NOT NULL DEFAULT 'YEARLY',
    "interestMethod" TEXT NOT NULL DEFAULT 'REDUCING',
    "tenure" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "emiAmount" DECIMAL(65,30) NOT NULL,
    "savingsAmount" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "processingFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "insurancePremium" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);

-- AlterTable BusinessDate (safe non-destructive add columns)
ALTER TABLE "BusinessDate" ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reopenedById" TEXT,
ADD COLUMN IF NOT EXISTS "reopenReason" TEXT;

-- AlterTable Account (safe non-destructive add columns)
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "productId" TEXT,
ADD COLUMN IF NOT EXISTS "savingsAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "processingFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "insurancePremium" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable Installment (safe non-destructive add columns)
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "savingsPart" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "paidSavings" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateIndex LoanProduct
CREATE UNIQUE INDEX IF NOT EXISTS "LoanProduct_productCode_key" ON "LoanProduct"("productCode");
CREATE INDEX IF NOT EXISTS "LoanProduct_status_idx" ON "LoanProduct"("status");
CREATE INDEX IF NOT EXISTS "LoanProduct_productCode_idx" ON "LoanProduct"("productCode");

-- CreateIndex Account productId
CREATE INDEX IF NOT EXISTS "Account_productId_idx" ON "Account"("productId");

-- AddForeignKey BusinessDate reopenedBy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BusinessDate_reopenedById_fkey'
    ) THEN
        ALTER TABLE "BusinessDate" ADD CONSTRAINT "BusinessDate_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey Account product
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Account_productId_fkey'
    ) THEN
        ALTER TABLE "Account" ADD CONSTRAINT "Account_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoanProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
