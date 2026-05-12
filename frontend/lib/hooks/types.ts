export type QueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  isEmpty: boolean;           // true when loaded but no data
  isSuccess: boolean;         // true when data is loaded (even if empty)
  errorMessage: string | null; // human-readable, never a raw Error
  refetch: () => void;
};


export type MutationResult<Input, Output = void> = {
  submit: (input: Input) => Promise<Output>;
  isSubmitting: boolean;
  isSuccess: boolean;         // true for ~3s after success, then resets
  isError: boolean;
  errorMessage: string | null;
  reset: () => void;
};

