-- CreateIndex
CREATE INDEX "Account_customerId_idx" ON "Account"("customerId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "Collection_customerId_idx" ON "Collection"("customerId");

-- CreateIndex
CREATE INDEX "Collection_accountId_idx" ON "Collection"("accountId");

-- CreateIndex
CREATE INDEX "Installment_accountId_idx" ON "Installment"("accountId");

-- CreateIndex
CREATE INDEX "Notification_collectionId_idx" ON "Notification"("collectionId");

-- CreateIndex
CREATE INDEX "Notification_customerId_idx" ON "Notification"("customerId");

-- CreateIndex
CREATE INDEX "Receipt_collectionId_idx" ON "Receipt"("collectionId");

