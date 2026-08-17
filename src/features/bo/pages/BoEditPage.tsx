import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errorMessage";
import { getBoById } from "@/lib/repositories/boRepository";
import type { BoRecord } from "../boTypes";
import BoFormPage from "./BoFormPage";

export default function BoEditPage({ boId }: { boId: string }) {
  const [record, setRecord] = useState<BoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void getBoById(boId)
      .then((item) => {
        if (!item) setError("B.O. não encontrado.");
        else setRecord(item);
      })
      .catch((cause) => setError(getErrorMessage(cause, "Não foi possível carregar o B.O.")))
      .finally(() => setLoading(false));
  }, [boId]);

  if (loading) return <div className="bo-muted py-16 text-center text-sm">Carregando B.O...</div>;
  if (!record) {
    return (
      <section className="bo-surface mx-auto max-w-xl rounded-2xl p-6 text-center">
        <h1 className="bo-title text-xl font-black">B.O. indisponível</h1>
        <p className="bo-muted mt-2 text-sm">{error}</p>
        <Link to="/bo/boletins" className="mt-5 inline-block text-sm font-bold text-violet-400">
          Voltar aos boletins
        </Link>
      </section>
    );
  }
  return <BoFormPage initial={record} />;
}
