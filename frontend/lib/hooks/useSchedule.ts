import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSchedule,
  upsertSchedule,
  type ScheduleFrequency,
} from "@/lib/api/schedule";

export function useSchedule(envId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["schedule", envId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSchedule(envId),
    staleTime: 30_000,
  });

  const schedule = data?.data ?? null;

  const { mutate, isPending: isMutating } = useMutation({
    mutationFn: (input: Parameters<typeof upsertSchedule>[1]) =>
      upsertSchedule(envId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function toggle() {
    mutate({
      frequency: schedule?.frequency ?? "DAILY",
      hour: schedule?.hour ?? 0,
      minute: schedule?.minute ?? 0,
      dayOfWeek: schedule?.dayOfWeek,
      dayOfMonth: schedule?.dayOfMonth,
      fromDate: schedule?.fromDate,
      isActive: !schedule?.isActive,
    });
  }

  function setFrequency(frequency: ScheduleFrequency) {
    mutate({
      frequency,
      hour: schedule?.hour ?? 0,
      minute: schedule?.minute ?? 0,
      dayOfWeek: schedule?.dayOfWeek,
      dayOfMonth: schedule?.dayOfMonth,
      fromDate: schedule?.fromDate,
      isActive: schedule?.isActive ?? true,
    });
  }

  return { schedule, isLoading, isMutating, toggle, setFrequency };
}
