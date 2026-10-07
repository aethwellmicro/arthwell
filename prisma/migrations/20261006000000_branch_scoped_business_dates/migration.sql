ALTER TABLE "BusinessDate" DROP CONSTRAINT IF EXISTS "BusinessDate_businessDate_key";
DROP INDEX IF EXISTS "BusinessDate_businessDate_key";

UPDATE "BusinessDate" AS business_date
SET "branchId" = opened_by."branchId"
FROM "User" AS opened_by
WHERE business_date."openedById" = opened_by."id"
	AND business_date."branchId" IS NULL
	AND opened_by."branchId" IS NOT NULL;

UPDATE "BusinessDate" AS open_date
SET "openingCash" = (
		SELECT previous_date."closingCash"
		FROM "BusinessDate" AS previous_date
		WHERE previous_date."branchId" IS NOT DISTINCT FROM open_date."branchId"
			AND previous_date."businessDate" < open_date."businessDate"
			AND previous_date."status" = 'CLOSED'
		ORDER BY previous_date."businessDate" DESC
		LIMIT 1
)
WHERE open_date."status" IN ('OPEN', 'REOPENED', 'RECONCILIATION_PENDING')
	AND open_date."openingCash" = 0
	AND EXISTS (
			SELECT 1
			FROM "BusinessDate" AS previous_date
			WHERE previous_date."branchId" IS NOT DISTINCT FROM open_date."branchId"
				AND previous_date."businessDate" < open_date."businessDate"
				AND previous_date."status" = 'CLOSED'
				AND previous_date."closingCash" > 0
	);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessDate_businessDate_branchId_key"
ON "BusinessDate"("businessDate", "branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessDate_businessDate_unassigned_key"
ON "BusinessDate"("businessDate")
WHERE "branchId" IS NULL;