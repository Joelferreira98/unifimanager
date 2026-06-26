-- CreateTable
CREATE TABLE "VoucherTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#111111',
    "accentColor" TEXT NOT NULL DEFAULT '#0075ff',
    "borderColor" TEXT NOT NULL DEFAULT '#999999',
    "headerText" TEXT,
    "subtitle" TEXT,
    "wifiName" TEXT,
    "instructions" TEXT,
    "footerText" TEXT,
    "cardsPerRow" INTEGER NOT NULL DEFAULT 3,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showPrice" BOOLEAN NOT NULL DEFAULT true,
    "showPlan" BOOLEAN NOT NULL DEFAULT true,
    "showDuration" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherTemplate_companyId_key" ON "VoucherTemplate"("companyId");

-- AddForeignKey
ALTER TABLE "VoucherTemplate" ADD CONSTRAINT "VoucherTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
