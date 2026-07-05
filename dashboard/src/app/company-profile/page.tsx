import { AvailabilityManager } from "@/components/AvailabilityManager";
import { CompanyInfoEditor } from "@/components/CompanyInfoEditor";
import { PoliciesEditor } from "@/components/PoliciesEditor";

export default function CompanyProfilePage() {
  return (
    <div>
      <h1>Профиль компании</h1>
      <p className="muted">Данные о заведении, политики и календарь доступности.</p>

      <CompanyInfoEditor />
      <PoliciesEditor />
      <AvailabilityManager />
    </div>
  );
}
