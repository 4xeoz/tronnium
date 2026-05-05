import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { appConfig } from "../config/config";

export async function seedTestUser() {
    const email = `test+${Date.now()}@example.com`;
    const user = await prisma.userAccount.create({
        data: {
            email,
            displayName: "Test User"
        }
    });

    const token = jwt.sign({ sub: user.id }, appConfig.jwtSecret, { expiresIn: "1h" });

    return { user, token };
}

export async function clearTestData(userId : string) {
    await prisma.environment.deleteMany({ where: { ownerId : userId }});
    await prisma.userAccount.delete({ where: { id : userId }});
}

export async function seedTestScan(
    environmentId: string,
    status: "COMPLETED" | "IN_PROGRESS" | "FAILED" = "COMPLETED",
    assetId?: string
) {
    const scan = await prisma.securityScan.create({
        data: {
            environmentId,
            status,
            startedAt: new Date(),
            completedAt: status === "COMPLETED" ? new Date() : null,
            totalAssets: assetId ? 1 : 0,
            scannedAssets: status === "COMPLETED" && assetId ? 1 : 0,
            vulnerabilitiesFound: 0,
        },
    });

    if (assetId && status === "COMPLETED") {
        await prisma.assetScan.create({
            data: {
                scanId: scan.id,
                assetId,
                scannedAt: new Date(),
            },
        });
    }

    return scan;
}