import { useCallback, useEffect, useState } from "react";

export function usePageLoader<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function PageLoadingState() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
      Loading...
    </div>
  );
}
