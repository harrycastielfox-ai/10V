import { AgendamentoFormPage } from "./AgendamentoFormPage";

export default function AgendamentoNovoPage({ remarcarDeId }: { remarcarDeId?: string }) {
  return <AgendamentoFormPage modo="create" remarcarDeId={remarcarDeId} />;
}
