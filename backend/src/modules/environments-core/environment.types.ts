export interface CreateEnvironmentInput {
  name: string;
  description?: string;
  labels?: string[];
}

export interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
  labels?: string[];
}

export interface PublicEnvironment {
  id: string;
  name: string;
  description: string | null;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  assetCount?: number;
}
