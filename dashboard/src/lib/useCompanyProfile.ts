"use client";

import { useCallback, useEffect, useState } from "react";

import { tmaFetch } from "@/lib/telegram/client";
import type { CompanyProfile } from "@/lib/types";

interface UseCompanyProfileResult {
  profile: CompanyProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Client-side data fetcher for GET /api/company-profile, shared by every CRUD page. */
export function useCompanyProfile(): UseCompanyProfileResult {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tmaFetch("/api/company-profile");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: CompanyProfile = await res.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, error, refetch };
}
