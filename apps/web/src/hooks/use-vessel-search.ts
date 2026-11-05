import { useMutation } from '@tanstack/react-query';
import type { VesselSearchResult } from '@mariner/ais';

export function useVesselSearch() {
  return useMutation({
    mutationFn: async (query: string): Promise<VesselSearchResult | null> => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      return response.json();
    },
  });
}
