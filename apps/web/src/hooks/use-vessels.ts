import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Bbox, VesselRecord } from '@mariner/ais';

interface VesselsResponse {
  updatedAt: string | null;
  vessels: VesselRecord[];
}

export function useVessels(bbox: Bbox | null) {
  return useQuery({
    queryKey: ['vessels', bbox],
    enabled: bbox !== null,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }): Promise<VesselsResponse> => {
      const response = await fetch(`/api/vessels?bbox=${bbox!.join(',')}`, { signal });
      if (!response.ok) throw new Error(`Failed to load vessels (${response.status})`);
      return response.json();
    },
  });
}
