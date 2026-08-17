import { supabase } from "@/lib/supabaseClient";

// Os repositórios guardam listas em memória por alguns segundos para não repetir
// a mesma consulta. Esses caches vivem enquanto a aba estiver aberta, então
// sobreviveriam a uma troca de usuário: quem entrasse depois veria dados de quem
// saiu. Todo cache se registra aqui e é limpo em qualquer mudança de sessão.

const resetHandlers = new Set<() => void>();
let sessionGeneration = 0;

export function registerSessionCache(reset: () => void) {
  resetHandlers.add(reset);
}

export function clearSessionCaches() {
  sessionGeneration += 1;
  for (const reset of resetHandlers) reset();
}

// Uma consulta disparada antes do logout ainda resolve depois dele. Cada busca
// guarda a geração no início e confere na volta, para que um resultado da sessão
// anterior não repovoe o cache recém-limpo.
export function currentSessionGeneration() {
  return sessionGeneration;
}

export function isSessionGenerationCurrent(generation: number) {
  return generation === sessionGeneration;
}

let cachedUserId: string | null = null;

// Cobre logout, login, expiração da sessão e troca feita em outra aba. Comparar
// o id evita limpar à toa nas renovações de token, que mantêm o mesmo usuário.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id ?? null;
    if (userId === cachedUserId) return;
    cachedUserId = userId;
    clearSessionCaches();
  });
}
