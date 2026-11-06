import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Bbox, VesselRecord } from '@mariner/ais';
import { useDataStatus } from '@/hooks/use-data-status';

interface VesselsResponse {
  updatedAt: string | null;
  vessels: VesselRecord[];
}

/** Fraction of the viewport size added on each side of a fetched area. */
const PAD = 0.5;

const contains = (outer: Bbox, inner: Bbox) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

function pad([minLng, minLat, maxLng, maxLat]: Bbox): Bbox {
  const dx = (maxLng - minLng) * PAD;
  const dy = (maxLat - minLat) * PAD;
  const round = (value: number) => Math.round(value * 10) / 10;
  return [
    Math.max(-180, round(minLng - dx)),
    Math.max(-90, round(minLat - dy)),
    Math.min(180, round(maxLng + dx)),
    Math.min(90, round(maxLat + dy)),
  ];
}

/** Fetches a padded area around the viewport. Refetches when the viewport leaves it or the ingested data changes. */
export function useVessels(viewport: Bbox | null) {
  const [loaded, setLoaded] = useState<Bbox | null>(null);
  if (viewport && (!loaded || !contains(loaded, viewport))) setLoaded(pad(viewport));

  const status = useDataStatus();
  const updatedAt = status.data?.updatedAt ?? null;

  return useQuery({
    queryKey: ['vessels', loaded, updatedAt],
    enabled: loaded !== null && status.isSuccess,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    queryFn: async ({ signal }): Promise<VesselsResponse> => {
      const response = await fetch(`/api/vessels?bbox=${loaded!.join(',')}&v=${updatedAt ?? ''}`, { signal });
      if (!response.ok) throw new Error(`Failed to load vessels (${response.status})`);
      return response.json();
    },
  });
}
