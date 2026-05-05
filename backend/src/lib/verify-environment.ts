import prisma from "./prisma";

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
