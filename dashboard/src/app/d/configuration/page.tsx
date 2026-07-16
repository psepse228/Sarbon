"use client";

import { useState } from "react";

import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { FaqEditor } from "@/components/FaqEditor";
import { KnowledgeGapsEditor } from "@/components/KnowledgeGapsEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";
import { useT } from "@/lib/i18n/LocaleProvider";

type ConfigTab = "info" | "faq" | "gaps" | "policies";

const TABS: { key: ConfigTab; labelKey: string }[] = [
  { key: "info", labelKey: "configuration.tabInfo" },
  { key: "faq", labelKey: "configuration.tabFaq" },
  { key: "gaps", labelKey: "configuration.tabGaps" },
  { key: "policies", labelKey: "configuration.tabPolicies" },
];

export default function DesktopConfigurationPage() {
  const t = useT();
  const [tab, setTab] = useState<ConfigTab>("info");

  return (
    <div>
      <h1>{t("configuration.title")}</h1>
      <p className="muted">{t("configuration.subtitle")}</p>

      <div className="segmented" style={{ marginBottom: "1.4rem", flexWrap: "wrap" }}>
        {TABS.map(({ key, labelKey }) => (
          <button key={key} data-active={tab === key} onClick={() => setTab(key)} type="button">
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === "info" && <CompanyInfoEditor />}
      {tab === "faq" && <FaqEditor />}
      {tab === "gaps" && <KnowledgeGapsEditor />}
      {tab === "policies" && <PoliciesEditor />}
    </div>
  );
}
