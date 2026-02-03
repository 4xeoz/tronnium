import type { Environment } from "@prisma/client";
import prisma from "../lib/prisma";

export type CreateEnvironmentInput = {
  name: string;
  description?: string;
  labels?: string[];
};

export type UpdateEnvironmentInput = {
  name?: string;
  description?: string;
  labels?: string[];
};

export type PublicEnvironment = {
  id: string;
  name: string;
  description: string | null;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  assetCount?: number;
};

class EnvironmentService {
  /**
   * Create a new environment for a user
   */
  async create(ownerId: string, data: CreateEnvironmentInput): Promise<Environment> {
    return prisma.environment.create({
      data: {
        ownerId,
        name: data.name,
        description: data.description,
        labels: data.labels || [],
      },
    });
  }

  /**
   * Find environment by ID
   */
  async findById(id: string): Promise<Environment | null> {
    return prisma.environment.findUnique({
      where: { id },
    });
  }

  /**
   * Find environment by ID and verify ownership
   */
  async findByIdAndOwner(id: string, ownerId: string): Promise<Environment | null> {
    return prisma.environment.findFirst({
      where: {
        id,
        ownerId,
      },
    });
  }

  /**
   * Get all environments for a user
   */
  async findAllByOwner(ownerId: string): Promise<Environment[]> {
    return prisma.environment.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get all environments for a user with asset count
   */
  async findAllByOwnerWithAssetCount(ownerId: string): Promise<PublicEnvironment[]> {
    const environments = await prisma.environment.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return environments.map((env) => ({
      id: env.id,
      name: env.name,
      description: env.description,
      labels: env.labels,
      createdAt: env.createdAt,
      updatedAt: env.updatedAt,
      assetCount: env._count.assets,
    }));
  }

  /**
   * Update an environment
   */
  async update(id: string, ownerId: string, data: UpdateEnvironmentInput): Promise<Environment | null> {
    // First verify ownership
    const existing = await this.findByIdAndOwner(id, ownerId);
    if (!existing) {
      return null;
    }

    return prisma.environment.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        labels: data.labels,
      },
    });
  }

  /**
   * Delete an environment (cascades to assets)
   */
  async delete(id: string, ownerId: string): Promise<boolean> {
    // First verify ownership
    const existing = await this.findByIdAndOwner(id, ownerId);
    if (!existing) {
      return false;
    }

    await prisma.environment.delete({
      where: { id },
    });

    return true;
  }

  /**
   * Convert to public representation
   */
  toPublic(env: Environment): PublicEnvironment {
    return {
      id: env.id,
      name: env.name,
      description: env.description,
      labels: env.labels,
      createdAt: env.createdAt,
      updatedAt: env.updatedAt,
    };
  }
}

export const environmentService = new EnvironmentService();
