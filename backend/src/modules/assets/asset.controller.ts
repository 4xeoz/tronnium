import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { verifyEnvironment } from "../environments/environment-helpers";
import type { PublicUser } from "../../types/express";
import type { CpeInput } from "../../types/asset.types";
import { ok, err } from "../../lib/response-helpers";
import { toCpeCandidate } from "./asset-helpers";

export async function getAssetsHandler(req: Request, res: Response) {
    try {
        const { environmentId } = req.params;
        const user = req.user as PublicUser;


        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json(err("NOT_FOUND", "Environment not found"));
        }

        const assets = await prisma.asset.findMany({
            where: { environmentId },
            orderBy: { createdAt: "desc" },
            include: { cpes: true },
        });

        return res.json(
            ok(
                assets.map((asset) => ({ ...asset, cpes: asset.cpes.map(toCpeCandidate) })),
                `Found ${assets.length} assets in environment ${environmentId}`
            )
        );
    } catch (error) {
        console.error("[Get Assets] Error:", error);
        return res.status(500).json(
            err("FETCH_FAILED", "Failed to get assets")
        );
    }
}

export async function createAssetHandler(req: Request, res: Response) {
    try {
        const { environmentId } = req.params;
        const user = req.user as PublicUser;
        const { name, description, cpes, domain, type, status, location, ipAddress, manufacturer, model, serialNumber } = req.body;

        if (!name || typeof name !== "string") {
            return res.status(400).json(
                err("INVALID_INPUT", "name is required and must be a string")
            );
        }

        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json(err("NOT_FOUND", "Environment not found"));
        }

        const selectedCpes: CpeInput[] = Array.isArray(cpes)
            ? cpes.filter((cpe: unknown): cpe is CpeInput =>
                typeof cpe === 'object' &&
                cpe !== null &&
                'cpeName' in cpe &&
                typeof (cpe as CpeInput).cpeName === 'string'
            )
            : [];

        const asset = await prisma.asset.create({
            data: {
                environmentId,
                name: name.trim(),
                description: description?.trim() || null,
                type: type?.trim() || "unknown",
                domain: domain || "UNKNOWN",
                status: status?.trim() || null,
                location: location?.trim() || null,
                ipAddress: ipAddress?.trim() || null,
                manufacturer: manufacturer?.trim() || null,
                model: model?.trim() || null,
                serialNumber: serialNumber?.trim() || null,
                cpes: {
                    create: selectedCpes.map((cpe) => ({
                        cpeName: cpe.cpeName,
                        cpeNameId: cpe.cpeNameId,
                        title: cpe.title,
                        score: cpe.score,
                        vendor: cpe.vendor,
                        product: cpe.product,
                        version: cpe.version,
                        vendorScore: cpe.breakdown.vendor,
                        productScore: cpe.breakdown.product,
                        versionScore: cpe.breakdown.version,
                        tokenOverlapScore: cpe.breakdown.tokenOverlap,
                    })),
                },
            },
            include: { cpes: true },
        });

        return res.status(201).json(
            ok({ ...asset, cpes: asset.cpes.map(toCpeCandidate) }, "Asset created successfully")
        );
    } catch (error) {
        console.error("[Create Asset] Error:", error);
        return res.status(500).json(
            err("CREATE_FAILED", "Failed to create asset")
        );
    }
}

export async function deleteAssetHandler(req: Request, res: Response) {
    try {
        const { environmentId, assetId } = req.params;
        const user = req.user as PublicUser;

        if (!assetId || typeof assetId !== "string") {
            return res.status(400).json(
                err("INVALID_INPUT", "assetId is required and must be a string")
            );
        }


        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json(err("NOT_FOUND", "Environment not found"));
        }

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, environmentId },
        });

        if (!asset) {
            return res.status(404).json(err("NOT_FOUND", "Asset not found in this environment"));
        }

        await prisma.asset.delete({
            where: { id: assetId },
        });
        return res.json(ok(null, "Asset deleted successfully"));

    } 
    
    catch (error) {
        console.error("[Delete Asset] Error:", error);
        return res.status(500).json(
            err("DELETE_FAILED", "Failed to delete asset")
        );
    }
}

export async function updateAssetHandler(req: Request, res: Response) {
    try {
        const { environmentId, assetId } = req.params;
        const user = req.user as PublicUser;
        const { name, description, domain, type, status, location, ipAddress, x, y } = req.body;

        console.log(`[Update Asset] User ${user.id} updating asset ${assetId} in environment ${environmentId} with data:`, req.body);

        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json(err("NOT_FOUND", "Environment not found"));
        }

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, environmentId },
        });

        if (!asset) {
            return res.status(404).json(err("NOT_FOUND", "Asset not found in this environment"));
        }

        const updateData: any = {};
        if (name && typeof name === "string") updateData.name = name.trim();
        if (description && typeof description === "string") updateData.description = description.trim();
        if (domain && typeof domain === "string") updateData.domain = domain.trim();
        if (type && typeof type === "string") updateData.type = type.trim();
        if (status && typeof status === "string") updateData.status = status.trim();
        if (location && typeof location === "string") updateData.location = location.trim();
        if (ipAddress && typeof ipAddress === "string") updateData.ipAddress = ipAddress.trim();
        if (typeof x === "number") updateData.x = x;
        if (typeof y === "number") updateData.y = y;

        const updated = await prisma.asset.update({
            where: { id: assetId },
            data: updateData,
            include: { cpes: true },
        });

        return res.json(
            ok({ ...updated, cpes: updated.cpes.map(toCpeCandidate) }, "Asset updated successfully")
        );
    } catch (error) {
        console.error("[Update Asset] Error:", error);
        return res.status(500).json(
            err("UPDATE_FAILED", "Failed to update asset")
        );
    }
}
