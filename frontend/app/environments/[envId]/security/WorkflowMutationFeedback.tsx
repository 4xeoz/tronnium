type Props = {
  updateError: string | null;
  bulkError: string | null;
  isSuccess: boolean;
};

export function WorkflowMutationFeedback({ updateError, bulkError, isSuccess }: Props) {
  return (
    <>
      {updateError && (
        <div className="p-4 bg-error-bg border border-error-border rounded-2xl text-error-text text-sm">
          Status update failed: {updateError}
        </div>
      )}
      {bulkError && (
        <div className="p-4 bg-error-bg border border-error-border rounded-2xl text-error-text text-sm">
          Bulk update failed: {bulkError}
        </div>
      )}
      {isSuccess && !updateError && (
        <div className="p-4 bg-success-bg border border-success-border rounded-2xl text-success-text text-sm">
          Status updated successfully
        </div>
      )}
    </>
  );
}
