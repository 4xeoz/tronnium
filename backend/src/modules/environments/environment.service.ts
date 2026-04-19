import type { Environment } from "@prisma/client";
import prisma from "../../lib/prisma";
import type {
  CreateEnvironmentInput,
  UpdateEnvironmentInput,
  PublicEnvironment,
} from "../../types/environment.types";

class EnvironmentService {
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

  async findById(id: string): Promise<Environment | null> {
    return prisma.environment.findUnique({
      where: { id },
    });
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Environment | null> {
    return prisma.environment.findFirst({
      where: {
        id,
        ownerId,
      },
    });
  }

  async findAllByOwner(ownerId: string): Promise<Environment[]> {
    return prisma.environment.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

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
