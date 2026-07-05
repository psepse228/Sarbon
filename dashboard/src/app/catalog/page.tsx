"use client";

import { useState } from "react";

import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";

type CatalogTab = "packages" | "partners";

export default function CatalogPage() {
  const [tab, setTab] = useState<CatalogTab>("packages");

  return (
    <div>
      <div className="segmented" style={{ marginBottom: "1.2rem" }}>
        <button data-active={tab === "packages"} onClick={() => setTab("packages")} type="button">
          Пакеты
        </button>
        <button data-active={tab === "partners"} onClick={() => setTab("partners")} type="button">
          Партнёры
        </button>
      </div>

      {tab === "packages" ? <PackagesEditor /> : <PartnersEditor />}
    </div>
  );
}
