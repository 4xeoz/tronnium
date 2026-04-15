import prisma from "./prisma";

/**
 * Verify that a user owns the given environment.
 * Returns true if the environment exists and belongs to the user, false otherwise.
 */
export async function verifyEnvironment(
  userId: string,
  environmentId: string
): Promise<boolean> {
  const env = await prisma.environment.findFirst({
    where: { id: environmentId, ownerId: userId },
    select: { id: true },
  });
  return env !== null;
}
