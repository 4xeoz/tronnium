import { Request, Response } from "express";
// import { relationshipService } from "../services/relationship.service";
import type { PublicUser } from "../services/user.service";
import { authorizationService } from "../services/authorization.service";
import { assetRelationshipService } from "../services/assetRelationship.service";


export async function getRelationshipsHandler(req: Request, res: Response) {
    const user = req.user as PublicUser;
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const { environmentId } = req.params;

    if (!environmentId) {
        return res.status(400).json({ message: "Environment ID is required." });
    }

    // check if the environment belongs to the user - this is important for security
    if (environmentId) {
        const isOwnerOfEnvironment = await authorizationService.isOwnerOfEnvironement(user.id, environmentId);
        if (!isOwnerOfEnvironment) {
            return res.status(403).json({ message: "Forbidden. You do not have access to this environment." });
        }
    }

    
    try {
        const relationships = await assetRelationshipService.findAllByEnvironment(environmentId);
        return res.json({ success: true, data : relationships, message: "Relationships fetched successfully." });
    } catch (error) {
        console.error("Error fetching relationships:", error);
        return res.status(500).json({ message: "Failed to fetch relationships." });
    }
}


export async function createRelationshipHandler(req: Request, res: Response) {

    const user = req.user as PublicUser;
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const { environmentId } = req.params;
    if (!environmentId) {
        return res.status(400).json({ message: "Environment ID is required." });
    }

    const { fromAssetId, toAssetId, type, criticality } = req.body;
    if (!fromAssetId || !toAssetId || !type || !criticality ) {
        return res.status(400).json({ message: "Missing required fields: fromAssetId, toAssetId, type, criticality." });
    }

    // validate the data types and values of the values
    if (typeof fromAssetId !== "string" || typeof toAssetId !== "string" || typeof type !== "string" || typeof criticality !== "string") {
        return res.status(400).json({ message: "Invalid data types for fields: fromAssetId, toAssetId, type, criticality." });
    }

    //check if assetfrom == assetto, if yes return error
    if (fromAssetId === toAssetId) {
        return res.status(400).json({ message: "fromAssetId and toAssetId cannot be the same." });
    }


    if (environmentId) {
        const isOwnerOfEnvironment = await authorizationService.isOwnerOfEnvironement(user.id, environmentId);
        if (!isOwnerOfEnvironment) {
            return res.status(403).json({ message: "Forbidden. You do not have access to this environment." });
        }
    }

    try {
        // TODO: create the relationship in the database
        const newRelationship = await assetRelationshipService.createRelationship(environmentId, fromAssetId, toAssetId, type, criticality);
        return res.status(201).json({ success: true, data: newRelationship, message: "Relationship created successfully." });
    } catch (error) {
        
    }
}


export async function updateRelationshipHandler(req: Request, res: Response) {}


export async function deleteRelationshipHandler(req: Request, res: Response) {}