import prisma from "../lib/prisma";
import type { PublicUser } from "./user.service";

class AuthorizationService {
    // Checks if the user is the owner of the environment
    public async isOwnerOfEnvironement(userId: string, environmentId: string, ): Promise<boolean> {
        const environment = await prisma.environment.findUnique({
            where: { id: environmentId },
            select: { ownerId: true },
        });

        return environment?.ownerId === userId;
    }

    // check if the user have access to asset 
    public async isOwnerOfAsset(userId: string, assetId: string): Promise<boolean> {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            select: { environment: { select: { ownerId: true } } },
        });

        return asset?.environment.ownerId === userId;
    }

    // check if the user have access to relationship 
    public async isOwnerOfRelationship(userId: string, relationshipId: string): Promise<boolean> {
        const relationship = await prisma.relationship.findUnique({
            where: { id: relationshipId },
            select: { environment: { select: { ownerId: true } } },
        });

        return relationship?.environment.ownerId === userId;
    }
}

export const authorizationService = new AuthorizationService();
