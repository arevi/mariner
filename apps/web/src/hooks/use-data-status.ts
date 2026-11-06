import type { DataStatus } from '@mariner/ais';
import { useQuery } from '@tanstack/react-query';
import { useNow } from '@/hooks/use-now';
import { formatDateTime, formatRelativeTime } from '@/lib/format';

export const STATUS_POLL_MS = 60_000;

/** Polls the cheap "when did the data last change" endpoint. */
export function useDataStatus() {
  return useQuery({
    queryKey: ['status'],
    refetchInterval: STATUS_POLL_MS,
    queryFn: async ({ signal }): Promise<DataStatus> => {
      const response = await fetch('/api/status', { signal });
      if (!response.ok) throw new Error(`Failed to load status (${response.status})`);
      return response.json();
    },
  });
}

/** "Last updated 5 min. ago" label that keeps ticking, plus the exact time for a tooltip. */
export function useLastUpdated() {
  const { data, isPending } = useDataStatus();
  const now = useNow();

  const updatedSec = data?.updatedAt ? Date.parse(data.updatedAt) / 1000 : null;
  const label = isPending ? 'Checking…' : updatedSec === null ? 'No data yet' : `Last updated ${formatRelativeTime(updatedSec, now)}`;
  return { label, title: updatedSec === null ? undefined : formatDateTime(updatedSec) };
}
