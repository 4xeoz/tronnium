import { Request, Response } from "express";
import { environmentService } from "./environments-core.service";
import type { PublicUser } from "../../types/user.types";
import { err, ok } from "../../lib/response-helpers";

export async function createEnvironmentHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;

  if (!user) {
    return res.status(401).json(err("USER_NOT_FOUND", "Login and try again" ));
  }

  const { name, description, labels } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json(err("INVALID_INPUT", "Name is required."));
  }

  try {
    const environment = await environmentService.create(user.id, {
      name: name.trim(),
      description: description?.trim(),
      labels: Array.isArray(labels) ? labels : [],
    });

    return res.status(201).json(ok(environmentService.toPublic(environment),"Environment created successfully."));
  } catch (error) {
    console.error("Error creating environment:", error);
    return res.status(500).json(err("CREATE_FAILED", "Failed to create environment."));
  }
}

export async function getEnvironmentsHandler(req: Request, res: Response) {
  try {
    const user = req.user as PublicUser;

    if (!user) {
      return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
    }

    const environments = await environmentService.findAllByOwnerWithAssetCount(user.id);
    return res.json(ok(environments, "Environments fetched successfully."));
  } catch (error) {
    console.error("Error fetching environments:", error);
    return res.status(500).json(err("FETCH_FAILED", "Failed to fetch environments."));
  }
}

export async function getEnvironmentByIdHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(404).json(err("NOT_FOUND", "Environment not found."));
  }

  try {
    const environment = await environmentService.findByIdAndOwner(id, user.id);

    if (!environment) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found."));
    }

    return res.json(ok(environmentService.toPublic(environment), "Environment fetched successfully."));
  } catch (error) {
    console.error("Error fetching environment:", error);
    return res.status(500).json(err("FETCH_FAILED", "Failed to fetch environment."));
  }
}

export async function updateEnvironmentHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  const { id } = req.params;
  const { name, description, labels } = req.body;

  if (!user) {
    return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
  }

  try {
    const updated = await environmentService.update(id, user.id, {
      name: name?.trim(),
      description: description?.trim(),
      labels: Array.isArray(labels) ? labels : undefined,
    });

    if (!updated) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found."));
    }

    return res.json(ok(environmentService.toPublic(updated), "Environment updated successfully."));
  } catch (error) {
    console.error("Error updating environment:", error);
    return res.status(500).json(err("UPDATE_FAILED", "Failed to update environment."));
  }
}

export async function deleteEnvironmentHandler(req: Request, res: Response) {
  const user = req.user as PublicUser;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
  }

  try {
    const deleted = await environmentService.delete(id, user.id);

    if (!deleted) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found."));
    }

    return res.json(ok(null, "Environment deleted."));
  } catch (error) {
    console.error("Error deleting environment:", error);
    return res.status(500).json(err("DELETE_FAILED", "Failed to delete environment."));
  }
}
