-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "appName" TEXT NOT NULL DEFAULT 'UniFi Hotspot',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0075ff',
    "gradientFrom" TEXT NOT NULL DEFAULT '#0075ff',
    "gradientTo" TEXT NOT NULL DEFAULT '#21d4fd',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
