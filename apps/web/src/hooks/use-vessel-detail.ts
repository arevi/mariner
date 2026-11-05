import { useQuery } from '@tanstack/react-query';
import type { VesselRow } from '@mariner/ais';

export function useVesselDetail(mmsi: number | null) {
  return useQuery({
    queryKey: ['vessel', mmsi],
    enabled: mmsi !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }): Promise<VesselRow | null> => {
      const response = await fetch(`/api/vessels/${mmsi}`, { signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Failed to load vessel (${response.status})`);
      return response.json();
    },
  });
}
