import { Request, Response } from "express";
import { environmentService } from "../services/environment.service";
import type { PublicUser } from "../services/user.service";

/**
 * Create a new environment
 * POST /environments
 */
export async function createEnvironmentHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  
  if (!user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  const { name, description, labels } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ message: "Name is required." });
  }

  try {
    const environment = await environmentService.create(user.id, {
      name: name.trim(),
      description: description?.trim(),
      labels: Array.isArray(labels) ? labels : [],
    });

    return res.status(201).json(environmentService.toPublic(environment));
  } catch (error) {
    console.error("Error creating environment:", error);
    return res.status(500).json({ message: "Failed to create environment." });
  }
}

/**
 * Get all environments for the authenticated user
 * GET /environments
 */
export async function getEnvironmentsHandler(req: Request, res: Response) {
  

  try {
    const user = req.user as PublicUser;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated." });
  }
  
    const environments = await environmentService.findAllByOwnerWithAssetCount(user.id);
    return res.json(environments);
  } catch (error) {
    console.error("Error fetching environments:", error);
    return res.status(500).json({ message: "Failed to fetch environments." });
  }
}

/**
 * Get a single environment by ID
 * GET /environments/:id
 */
export async function getEnvironmentByIdHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  try {
    const environment = await environmentService.findByIdAndOwner(id, user.id);

    if (!environment) {
      return res.status(404).json({ message: "Environment not found." });
    }

    return res.json(environmentService.toPublic(environment));
  } catch (error) {
    console.error("Error fetching environment:", error);
    return res.status(500).json({ message: "Failed to fetch environment." });
  }
}

/**
 * Update an environment
 * PUT /environments/:id
 */
export async function updateEnvironmentHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  const { id } = req.params;
  const { name, description, labels } = req.body;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  try {
    const updated = await environmentService.update(id, user.id, {
      name: name?.trim(),
      description: description?.trim(),
      labels: Array.isArray(labels) ? labels : undefined,
    });

    if (!updated) {
      return res.status(404).json({ message: "Environment not found." });
    }

    return res.json(environmentService.toPublic(updated));
  } catch (error) {
    console.error("Error updating environment:", error);
    return res.status(500).json({ message: "Failed to update environment." });
  }
}

/**
 * Delete an environment
 * DELETE /environments/:id
 */
export async function deleteEnvironmentHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated." });
  }

  try {
    const deleted = await environmentService.delete(id, user.id);

    if (!deleted) {
      return res.status(404).json({ message: "Environment not found." });
    }

    return res.json({ success: true, message: "Environment deleted." });
  } catch (error) {
    console.error("Error deleting environment:", error);
    return res.status(500).json({ message: "Failed to delete environment." });
  }
}
