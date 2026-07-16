"use client";

import { useEffect, useState } from "react";

import { ErrorBanner } from "@/components/StatusBanner";
import { StarIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/LocaleProvider";
import { tmaFetch } from "@/lib/telegram/client";
import type { Review } from "@/lib/types";

export default function ReviewsPage() {
  const t = useT();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tmaFetch("/api/reviews")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Не удалось загрузить отзывы (${res.status})`);
        return (await res.json()) as Review[];
      })
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить отзывы");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const average = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  if (loading) return <p className="muted">{t("reviews.loading")}</p>;

  return (
    <div>
      <h1>{t("reviews.title")}</h1>
      <p className="muted">{t("reviews.subtitle")}</p>

      {error && <ErrorBanner message={error} />}

      <div className="desktop-kpi-row">
        <div className="kpi-tile">
          <div className="kpi-value kpi-value-good">{average ? average.toFixed(1) : "—"}</div>
          <div className="kpi-label">{t("reviews.averageRating")}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-value">{reviews.length}</div>
          <div className="kpi-label">{t("reviews.totalReviews")}</div>
        </div>
      </div>

      {reviews.length === 0 && <p className="muted">{t("reviews.noneYet")}</p>}

      {reviews.map((review) => (
        <div key={review.id} className="card">
          <div
            style={{ display: "flex", gap: "0.2rem", marginBottom: "0.5rem" }}
            aria-label={t("reviews.ratingLabel").replace("{rating}", String(review.rating))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon key={n} className={n <= review.rating ? "review-star-filled" : "review-star-empty"} />
            ))}
          </div>
          {review.comment && <p>{review.comment}</p>}
          <p className="muted">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</p>
        </div>
      ))}
    </div>
  );
}
