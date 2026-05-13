import prisma from "../../lib/prisma";
import type { PublicUser } from "../../types/user.types";
import type { RelationshipCriticality, RelationType } from "@prisma/client";


class AssetRelationshipService {
    public async findAllByEnvironment(environmentId: string) {
        return prisma.relationship.findMany({
            where: { environmentId },
        });
    }

    // Create a new relationship between two assets
    public async createRelationship(environmentId: string, fromAssetId: string, toAssetId: string, type: RelationType, operationalCriticality: RelationshipCriticality) {

        return prisma.relationship.create({
            data: {
                environmentId,
                fromAssetId,
                toAssetId,
                type ,
                operationalCriticality
            },
        });
    }

    // Delete a relationship by its ID
    public async deleteRelationship(relationshipId: string) {
        return prisma.relationship.delete({
            where: { id: relationshipId },
        });
    }

    // Update the operationalCriticality or type of a relationship
    public async updateRelationship(relationshipId: string, type?: string, operationalCriticality?: string) {
        const data: any = {};
        if (type) data.type = type;
        if (operationalCriticality) data.operationalCriticality = operationalCriticality;

        return prisma.relationship.update({
            where: { id: relationshipId },
            data,
        });
    }

    
}

export const assetRelationshipService = new AssetRelationshipService();