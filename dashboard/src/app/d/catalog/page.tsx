"use client";

import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function CatalogPage() {
  const t = useT();
  return (
    <div>
      <h1>{t("catalog.title")}</h1>
      <p className="muted">{t("catalog.subtitle")}</p>

      <PackagesEditor />

      <div style={{ marginTop: "2.5rem" }}>
        <PartnersEditor />
      </div>
    </div>
  );
}
