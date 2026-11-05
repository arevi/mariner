import type { VesselSearchResult } from '@mariner/ais';
import { AlertCircleIcon, SearchIcon, ShipIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useVesselSearch } from '@/hooks/use-vessel-search';

interface VesselSearchProps {
  onResult: (result: VesselSearchResult) => void;
}

export function VesselSearch({ onResult }: VesselSearchProps) {
  const [query, setQuery] = useState('');
  const search = useVesselSearch();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    search.mutate(trimmed, {
      onSuccess: (result) => {
        if (!result) return;
        setQuery('');
        onResult(result);
      },
    });
  };

  const notFound = search.isSuccess && search.data === null;

  return (
    <form
      onSubmit={onSubmit}
      className="bg-background/20 absolute top-6 left-4 z-10 w-72 overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl backdrop-saturate-150"
    >
      <header className="flex items-center gap-3 bg-linear-to-br from-primary/20 to-transparent to-70% p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
          <ShipIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base leading-tight font-semibold">Find a vessel</h2>
          <p className="text-muted-foreground text-xs">Search by call sign or MMSI</p>
        </div>
      </header>
      <Separator />
      <div className="space-y-2 p-4">
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            id="vessel-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!search.isIdle) search.reset();
            }}
            placeholder="e.g. 211518370 or DABC"
            autoComplete="off"
            aria-label="Call sign or MMSI"
            aria-invalid={notFound || search.isError}
            className="pl-8"
          />
        </div>
        <Button type="submit" className="w-full disabled:pointer-events-auto" disabled={search.isPending || !query.trim()}>
          {search.isPending ? 'Searching…' : 'Search'}
        </Button>
        {notFound && (
          <p className="text-destructive flex items-start gap-1.5 text-xs">
            <AlertCircleIcon className="mt-px size-3.5 shrink-0" />
            No vessel found for “{search.variables}”.
          </p>
        )}
        {search.isError && (
          <p className="text-destructive flex items-start gap-1.5 text-xs">
            <AlertCircleIcon className="mt-px size-3.5 shrink-0" />
            Search failed. Please try again.
          </p>
        )}
      </div>
    </form>
  );
}
