import { PackagesEditor } from "@/components/PackagesEditor";
import { PartnersEditor } from "@/components/PartnersEditor";

export default function CatalogPage() {
  return (
    <div>
      <h1>Каталог</h1>
      <p className="muted">Пакеты и партнёры, которые бот показывает клиентам.</p>

      <PackagesEditor />

      <div style={{ marginTop: "2.5rem" }}>
        <PartnersEditor />
      </div>
    </div>
  );
}
