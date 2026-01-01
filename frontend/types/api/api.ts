export type apiResult<T> = {
  payload: T | null;
  error: string | null;
  status: number | null;
};