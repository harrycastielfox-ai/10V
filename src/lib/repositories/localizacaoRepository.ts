import type {
  BairroOperacionalRecord,
  BairroPainelRecord,
  EnderecoPayload,
  EnderecoRecord,
  LocalizacaoOverviewStats,
  MapaEnderecoRecord,
  MapaPessoaRecord,
  PessoaAlvoPayload,
  PessoaAlvoRecord,
  PessoaCadastroCompletoPayload,
  PessoaComLocal,
  PessoaDetalheRecord,
  PessoaTelefoneContato,
  RotaSalvaRecord,
} from "@/features/localizacao/localizacaoTypes";
import { BAIRROS_OPERACIONAIS_ITABELA } from "@/features/localizacao/localizacaoConstants";
import { buildMapDirectionsUrl, buildWazeUrl, DEFAULT_ROUTE_ORIGIN } from "@/lib/mapLinks";
import { supabase } from "@/lib/supabaseClient";

const PRIVATE_BUCKET = "localizacao-private";

type SupabaseError = { message: string; code?: string; details?: string | null };

function fail(context: string, error: SupabaseError | null): never {
  console.error(`[localizacaoRepository] ${context}`, error);
  throw new Error(error?.message || context);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function safeSearch(value: string) {
  return value
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ");
}

async function findAddressIds(search: string): Promise<string[]> {
  const safe = safeSearch(search);
  if (!safe) return [];
  const { data, error } = await supabase
    .from("localizacao_enderecos")
    .select("id")
    .is("deleted_at", null)
    .or(
      `logradouro.ilike.%${safe}%,bairro.ilike.%${safe}%,ponto_referencia.ilike.%${safe}%,como_chegar.ilike.%${safe}%`,
    )
    .limit(60);
  if (error) fail("Falha ao localizar endereços relacionados à busca", error);
  return (data ?? []).map((item) => item.id);
}

function formatAddress(
  address: Pick<EnderecoRecord, "logradouro" | "numero" | "sem_numero"> | null,
) {
  if (!address) return "Endereço não informado";
  const number = address.sem_numero ? "s/n" : (address.numero ?? "s/n");
  return `${address.logradouro}, ${number}`;
}

function asAddress(value: unknown): EnderecoRecord | null {
  if (!value) return null;
  return (Array.isArray(value) ? value[0] : value) as EnderecoRecord | null;
}

/**
 * A coluna "telefone" (legada, texto simples) precisa continuar espelhando o
 * primeiro contato da lista — é ela que alimenta o índice de busca rápida.
 */
function primaryPhone(telefones: PessoaTelefoneContato[] | undefined): string | null {
  return telefones?.[0]?.numero?.trim() || null;
}

const TEST_NOW = "2026-08-03T12:00:00.000Z";
const TEST_ADDRESS: EnderecoRecord = {
  id: "test-address",
  logradouro: "Rua das Palmeiras",
  numero: "87",
  sem_numero: false,
  complemento: null,
  bairro: "Centro",
  bairro_id: "bairro-centro",
  bairro_status: "confirmado",
  bairro_confirmado_em: TEST_NOW,
  bairro_confirmado_por: null,
  bairro_revisado_em: TEST_NOW,
  bairro_revisado_por: null,
  municipio: "Itabela",
  uf: "BA",
  cep: null,
  ponto_referencia: "Próximo à praça principal",
  como_chegar: "Sobrado amarelo ao lado da praça, portão de grade preta.",
  latitude: -16.5721,
  longitude: -39.4863,
  maps_url: null,
  confirmado: true,
  observacoes: null,
  created_at: TEST_NOW,
  updated_at: TEST_NOW,
  created_by: null,
};

const TEST_BAIRROS: BairroOperacionalRecord[] = BAIRROS_OPERACIONAIS_ITABELA.map(
  (bairro, index) => ({
    id: `bairro-${bairro.nome}`,
    nome: bairro.nome,
    chave: bairro.nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    aliases: [...bairro.aliases],
    municipio: "Itabela",
    uf: "BA",
    ordem: index + 1,
    centro_latitude: bairro.centro?.[0] ?? null,
    centro_longitude: bairro.centro?.[1] ?? null,
    limite_geojson: null,
    posicao_confirmada: bairro.centro !== null,
    fonte: null,
    ativo: true,
  }),
);
const TEST_PEOPLE: PessoaComLocal[] = [
  {
    id: "test-person-1",
    nome: "J. C. S.",
    apelido: "Nêgo do Sítio",
    telefone: "(73) 9 8814-2207",
    foto_perfil_path: null,
    vinculo: "alvo",
    numero_bo: null,
    numero_procedimento: null,
    inquerito_id: null,
    endereco: TEST_ADDRESS,
    fotos_local: [],
  },
  {
    id: "test-person-2",
    nome: "M. A. P.",
    apelido: "Dona Preta",
    telefone: "(73) 9 9127-4460",
    foto_perfil_path: null,
    vinculo: "testemunha",
    numero_bo: null,
    numero_procedimento: null,
    inquerito_id: null,
    endereco: {
      ...TEST_ADDRESS,
      id: "test-address-2",
      bairro: "Alvorada",
      bairro_id: null,
      bairro_status: "pendente",
      bairro_confirmado_em: null,
      bairro_revisado_em: null,
      bairro_revisado_por: null,
      ponto_referencia: "Acesso pela padaria",
      como_chegar: "Entre pela padaria e siga até o portão azul.",
    },
    fotos_local: [],
  },
];

export async function getLocalizacaoOverviewStats(): Promise<LocalizacaoOverviewStats> {
  const { data, error } = await supabase.rpc("localizacao_overview_stats");
  if (error) fail("Falha ao carregar indicadores de localização", error);
  const stats = (data ?? {}) as Partial<LocalizacaoOverviewStats>;
  return {
    ativas: Number(stats.ativas ?? 0),
    em_deslocamento: Number(stats.em_deslocamento ?? 0),
    no_local: Number(stats.no_local ?? 0),
    concluidas_hoje: Number(stats.concluidas_hoje ?? 0),
    enderecos_cadastrados: Number(stats.enderecos_cadastrados ?? 0),
    pessoas_cadastradas: Number(stats.pessoas_cadastradas ?? 0),
    fotos_30_dias: Number(stats.fotos_30_dias ?? 0),
    por_dia: Array.isArray(stats.por_dia) ? stats.por_dia : [],
  };
}

export async function listBairrosOperacionais(): Promise<BairroOperacionalRecord[]> {
  if (import.meta.env.MODE === "test") return TEST_BAIRROS;

  const { data, error } = await supabase
    .from("localizacao_bairros")
    .select(
      "id, nome, chave, aliases, municipio, uf, ordem, centro_latitude, centro_longitude, limite_geojson, posicao_confirmada, fonte, ativo",
    )
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(100);
  if (error) fail("Falha ao carregar o catálogo territorial", error);
  return (data ?? []) as BairroOperacionalRecord[];
}

/**
 * Ficha territorial carregada somente ao selecionar um bairro. O RPC devolve
 * contadores completos, mas limita as listas visuais para manter o painel leve.
 */
export async function getBairroPainel(bairroId: string): Promise<BairroPainelRecord | null> {
  if (import.meta.env.MODE === "test") {
    const bairro = TEST_BAIRROS.find((item) => item.id === bairroId) ?? null;
    if (!bairro) return null;
    const pessoas = TEST_PEOPLE.filter(
      (person) =>
        person.endereco?.bairro && normalize(person.endereco.bairro) === normalize(bairro.nome),
    ).map((person) => ({
      id: person.id,
      nome: person.nome,
      apelido: person.apelido,
      foto_perfil_path: person.foto_perfil_path,
      vinculo: person.vinculo,
      endereco: person.endereco,
    }));
    const enderecos = pessoas
      .map((person) => person.endereco)
      .filter((address): address is EnderecoRecord => address !== null);
    return {
      bairro_id: bairro.id,
      bairro_nome: bairro.nome,
      enderecos_total: enderecos.length,
      enderecos_posicionados: enderecos.filter(
        (address) => address.latitude !== null && address.longitude !== null,
      ).length,
      pessoas_total: pessoas.length,
      diligencias_ativas: 0,
      enderecos,
      pessoas,
      diligencias: [],
    };
  }

  const { data, error } = await supabase.rpc("localizacao_bairro_painel", {
    p_bairro_id: bairroId,
  });
  if (error) fail("Falha ao carregar o painel territorial do bairro", error);
  if (!data || typeof data !== "object" || !("bairro_id" in data)) return null;

  const panel = data as Partial<BairroPainelRecord>;
  return {
    bairro_id: String(panel.bairro_id),
    bairro_nome: String(panel.bairro_nome ?? "Bairro"),
    enderecos_total: Number(panel.enderecos_total ?? 0),
    enderecos_posicionados: Number(panel.enderecos_posicionados ?? 0),
    pessoas_total: Number(panel.pessoas_total ?? 0),
    diligencias_ativas: Number(panel.diligencias_ativas ?? 0),
    enderecos: Array.isArray(panel.enderecos) ? panel.enderecos : [],
    pessoas: Array.isArray(panel.pessoas) ? panel.pessoas : [],
    diligencias: Array.isArray(panel.diligencias) ? panel.diligencias : [],
  };
}

export async function listEnderecos(search = ""): Promise<EnderecoRecord[]> {
  let query = supabase
    .from("localizacao_enderecos")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (search.trim()) {
    const safe = safeSearch(search);
    query = query.or(
      `logradouro.ilike.%${safe}%,bairro.ilike.%${safe}%,ponto_referencia.ilike.%${safe}%,como_chegar.ilike.%${safe}%`,
    );
  }
  const { data, error } = await query;
  if (error) fail("Falha ao listar endereços", error);
  return (data ?? []) as EnderecoRecord[];
}

export interface EnderecosPendentesResult {
  records: EnderecoRecord[];
  total: number;
}

/**
 * Fila limitada para revisao humana. O contador vem do servidor e somente o
 * lote atual trafega para o navegador.
 */
export async function listEnderecosPendentes(limit = 25): Promise<EnderecosPendentesResult> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  if (import.meta.env.MODE === "test") {
    const records = TEST_PEOPLE.map((person) => person.endereco).filter(
      (address): address is EnderecoRecord => address?.bairro_status === "pendente",
    );
    return { records: records.slice(0, safeLimit), total: records.length };
  }

  const { data, error, count } = await supabase
    .from("localizacao_enderecos")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .eq("bairro_status", "pendente")
    .order("updated_at", { ascending: true })
    .limit(safeLimit);

  if (error) fail("Falha ao carregar a fila de bairros pendentes", error);
  return { records: (data ?? []) as EnderecoRecord[], total: count ?? 0 };
}

/**
 * Camada territorial leve. Busca somente o necessário para posicionar endereços
 * e formar bairros; fichas e fotografias não trafegam nesta etapa.
 */
export async function listMapaEnderecos(): Promise<MapaEnderecoRecord[]> {
  if (import.meta.env.MODE === "test") {
    return TEST_PEOPLE.map((person) => person.endereco).filter(
      (address): address is EnderecoRecord => address !== null,
    );
  }

  const pageSize = 500;
  const records: MapaEnderecoRecord[] = [];

  for (let page = 0; page < 20; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("localizacao_enderecos")
      .select(
        "id, logradouro, numero, sem_numero, bairro, bairro_id, bairro_status, municipio, uf, latitude, longitude, maps_url",
      )
      .is("deleted_at", null)
      .order("bairro", { ascending: true, nullsFirst: false })
      .order("logradouro", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) fail("Falha ao carregar os endereços do mapa", error);
    const batch = (data ?? []) as MapaEnderecoRecord[];
    records.push(...batch);
    if (batch.length < pageSize) break;
  }

  return records;
}

/**
 * Os perfis são buscados apenas depois que o usuário seleciona um bairro ou
 * aproxima o mapa. O limite protege a tela quando uma área possui muitos cadastros.
 */
export async function listMapaPessoasPorEnderecos(
  addressIds: string[],
  limit = 80,
): Promise<MapaPessoaRecord[]> {
  const uniqueIds = Array.from(new Set(addressIds)).slice(0, 300);
  if (!uniqueIds.length) return [];

  if (import.meta.env.MODE === "test") {
    return TEST_PEOPLE.filter((person) =>
      person.endereco ? uniqueIds.includes(person.endereco.id) : false,
    ).slice(0, limit);
  }

  const { data, error } = await supabase
    .from("localizacao_pessoas")
    .select(
      "id, nome, apelido, foto_perfil_path, vinculo, endereco:localizacao_enderecos(id, logradouro, numero, sem_numero, bairro, bairro_id, bairro_status, municipio, uf, latitude, longitude, maps_url)",
    )
    .is("deleted_at", null)
    .in("endereco_id", uniqueIds)
    .order("nome", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 120));

  if (error) fail("Falha ao carregar as pessoas da área selecionada", error);
  return (data ?? []).map((person) => ({
    id: person.id,
    nome: person.nome,
    apelido: person.apelido,
    foto_perfil_path: person.foto_perfil_path,
    vinculo: person.vinculo,
    endereco: asAddress(person.endereco) as MapaEnderecoRecord | null,
  })) as MapaPessoaRecord[];
}

export async function createEndereco(payload: EnderecoPayload): Promise<EnderecoRecord> {
  const { data, error } = await supabase
    .from("localizacao_enderecos")
    .insert(payload)
    .select("*")
    .single();
  if (error) fail("Falha ao criar endereço", error);
  return data as EnderecoRecord;
}

export async function softDeleteEndereco(id: string): Promise<void> {
  // Pela função, e não por UPDATE direto: a policy de SELECT esconde a linha
  // com deleted_at preenchido, e o cliente não consegue recebê-la de volta.
  const { data, error } = await supabase.rpc("soft_delete_localizacao_endereco", {
    p_endereco_id: id,
  });
  if (error) fail("Falha ao excluir endereço", error);
  if (!data) {
    throw new Error("Endereço não encontrado ou já excluído.");
  }
}

export async function confirmarBairroEndereco(
  enderecoId: string,
  bairro: Pick<BairroOperacionalRecord, "id" | "nome">,
): Promise<EnderecoRecord> {
  const { data, error } = await supabase
    .from("localizacao_enderecos")
    .update({
      bairro_id: bairro.id,
      bairro: bairro.nome,
      bairro_status: "confirmado",
    })
    .eq("id", enderecoId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) fail("Falha ao confirmar o bairro do endereço", error);
  return data as EnderecoRecord;
}

export async function marcarBairroNaoIdentificado(enderecoId: string): Promise<EnderecoRecord> {
  const { data, error } = await supabase
    .from("localizacao_enderecos")
    .update({ bairro_id: null, bairro_status: "nao_identificado" })
    .eq("id", enderecoId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) fail("Falha ao concluir o bairro como não identificado", error);
  return data as EnderecoRecord;
}

export async function buscarPessoasComLocal(search = ""): Promise<PessoaComLocal[]> {
  if (import.meta.env.MODE === "test") {
    const target = normalize(search);
    return TEST_PEOPLE.filter((person) => {
      if (!target) return true;
      const address = person.endereco;
      return [
        person.nome,
        person.apelido ?? "",
        person.telefone ?? "",
        address?.logradouro ?? "",
        address?.bairro ?? "",
        address?.ponto_referencia ?? "",
        address?.como_chegar ?? "",
      ].some((value) => normalize(value).includes(target));
    });
  }

  const people = await listPessoas(search);
  return people.map((person) => ({
    id: person.id,
    nome: person.nome,
    apelido: person.apelido,
    telefone: person.telefone,
    foto_perfil_path: person.foto_perfil_path,
    vinculo: person.vinculo,
    numero_bo: person.numero_bo,
    numero_procedimento: person.numero_procedimento,
    inquerito_id: person.inquerito_id,
    endereco: asAddress((person as PessoaAlvoRecord & { endereco?: unknown }).endereco),
    fotos_local: [],
  }));
}

export async function getPessoaComLocal(id: string): Promise<PessoaComLocal | null> {
  const { data, error } = await supabase
    .from("localizacao_pessoas")
    .select("*, endereco:localizacao_enderecos(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("Falha ao carregar pessoa", error);
  if (!data) return null;
  return {
    id: data.id,
    nome: data.nome,
    apelido: data.apelido,
    telefone: data.telefone,
    foto_perfil_path: data.foto_perfil_path,
    vinculo: data.vinculo,
    numero_bo: data.numero_bo,
    numero_procedimento: data.numero_procedimento,
    inquerito_id: data.inquerito_id,
    endereco: asAddress(data.endereco),
    fotos_local: [],
  } as PessoaComLocal;
}

export async function getPessoaDetalhes(id: string): Promise<PessoaDetalheRecord | null> {
  const { data, error } = await supabase
    .from("localizacao_pessoas")
    .select("*, endereco:localizacao_enderecos(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) fail("Falha ao carregar ficha da pessoa", error);
  if (!data) return null;

  return {
    ...data,
    endereco: asAddress(data.endereco),
  } as unknown as PessoaDetalheRecord;
}

export async function listPessoas(search = ""): Promise<PessoaAlvoRecord[]> {
  const safe = safeSearch(search);
  const addressIds = safe ? await findAddressIds(safe) : [];
  let query = supabase
    .from("localizacao_pessoas")
    .select("*, endereco:localizacao_enderecos(*)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (safe) {
    const clauses = [
      `nome.ilike.%${safe}%`,
      `apelido.ilike.%${safe}%`,
      `telefone.ilike.%${safe}%`,
      `numero_bo.ilike.%${safe}%`,
      `numero_procedimento.ilike.%${safe}%`,
    ];
    if (addressIds.length) clauses.push(`endereco_id.in.(${addressIds.join(",")})`);
    query = query.or(clauses.join(","));
  }
  const { data, error } = await query;
  if (error) fail("Falha ao listar pessoas", error);
  return (data ?? []) as unknown as PessoaAlvoRecord[];
}

export async function softDeletePessoa(id: string): Promise<void> {
  const { data, error } = await supabase.rpc("soft_delete_localizacao_pessoa", {
    p_pessoa_id: id,
  });
  if (error) fail("Falha ao excluir contato", error);
  if (!data) {
    throw new Error("Contato não encontrado ou já excluído.");
  }
}

/** "telefone" não entra pelo chamador — é sempre derivado de telefones[0] aqui dentro. */
export async function createPessoa(
  payload: Omit<PessoaAlvoPayload, "telefone">,
): Promise<PessoaAlvoRecord> {
  const { data, error } = await supabase
    .from("localizacao_pessoas")
    .insert({ ...payload, telefone: primaryPhone(payload.telefones) })
    .select("*")
    .single();
  if (error) fail("Falha ao criar pessoa", error);
  return data as PessoaAlvoRecord;
}

interface PhotoCompressionOptions {
  maxDimension: number;
  quality: number;
}

async function compressPhoto(
  file: File,
  { maxDimension, quality }: PhotoCompressionOptions,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 12 * 1024 * 1024) throw new Error("A fotografia deve ter no máximo 12 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a fotografia.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a foto."))),
      "image/webp",
      quality,
    );
  });
}

export async function uploadPessoaFoto(personId: string, file: File): Promise<string> {
  const [profileBlob, thumbnailBlob] = await Promise.all([
    compressPhoto(file, { maxDimension: 1600, quality: 0.92 }),
    compressPhoto(file, { maxDimension: 320, quality: 0.9 }),
  ]);
  const photoId = crypto.randomUUID();
  const profilePath = `pessoas/${personId}/profile-${photoId}.webp`;
  const thumbnailPath = `pessoas/${personId}/thumbnail-${photoId}.webp`;

  const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(profilePath, profileBlob, {
    contentType: "image/webp",
    cacheControl: "86400",
    upsert: false,
  });
  if (error) fail("Falha ao enviar fotografia da pessoa", error);

  const { error: thumbnailError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(thumbnailPath, thumbnailBlob, {
      contentType: "image/webp",
      cacheControl: "86400",
      upsert: false,
    });
  if (thumbnailError) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([profilePath]);
    fail("Falha ao gerar miniatura da pessoa", thumbnailError);
  }

  const { error: updateError } = await supabase
    .from("localizacao_pessoas")
    .update({ foto_perfil_path: profilePath })
    .eq("id", personId);
  if (updateError) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([profilePath, thumbnailPath]);
    fail("Foto enviada, mas o cadastro não foi atualizado", updateError);
  }
  return profilePath;
}

export async function getPessoaPhotoSignedUrl(
  path: string | null,
  variant: "profile" | "thumbnail" = "profile",
): Promise<string | null> {
  if (!path) return null;
  const requestedPath =
    variant === "thumbnail" && path.includes("/profile-")
      ? path.replace("/profile-", "/thumbnail-")
      : path;
  return getLocalizacaoPhotoSignedUrl(requestedPath);
}

export async function getLocalizacaoPhotoSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function createPessoaCadastroCompleto(
  payload: PessoaCadastroCompletoPayload,
): Promise<{
  pessoa: PessoaAlvoRecord;
  foto_ok: boolean;
  rota_ok: boolean;
}> {
  let addressId = payload.endereco_id;
  let createdAddressId: string | null = null;
  if (payload.endereco) {
    const address = await createEndereco(payload.endereco);
    addressId = address.id;
    createdAddressId = address.id;
  }

  let person: PessoaAlvoRecord;
  try {
    person = await createPessoa({
      ...payload.pessoa,
      endereco_id: addressId,
      foto_perfil_path: null,
    });
  } catch (error) {
    if (createdAddressId) {
      await supabase
        .from("localizacao_enderecos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", createdAddressId);
    }
    throw error;
  }

  let photoOk = !payload.foto;
  if (payload.foto) {
    try {
      const path = await uploadPessoaFoto(person.id, payload.foto);
      person = { ...person, foto_perfil_path: path };
      photoOk = true;
    } catch (error) {
      console.error("[localizacaoRepository] Pessoa salva, mas a foto falhou", error);
    }
  }

  let routeOk = !payload.salvar_rota;
  if (payload.salvar_rota && addressId) {
    try {
      const address =
        payload.endereco ?? (await listEnderecos()).find((item) => item.id === addressId);
      const target = address
        ? {
            endereco: formatAddress(address),
            latitude: address.latitude,
            longitude: address.longitude,
            cidade: `${address.municipio}, ${address.uf}`,
          }
        : null;
      if (target) {
        const { error } = await supabase.from("localizacao_rotas_salvas").insert({
          nome: `Delegacia → ${person.apelido || person.nome}`,
          destino_endereco_id: addressId,
          pessoa_id: person.id,
          google_maps_url: buildMapDirectionsUrl(target, {
            origin: DEFAULT_ROUTE_ORIGIN,
          }),
          waze_url: buildWazeUrl(target),
        });
        if (error) throw error;
        routeOk = true;
      }
    } catch (error) {
      console.error("[localizacaoRepository] Pessoa salva, mas a rota falhou", error);
    }
  }

  return { pessoa: person, foto_ok: photoOk, rota_ok: routeOk };
}

export async function updatePessoaCadastroCompleto(
  personId: string,
  payload: PessoaCadastroCompletoPayload,
): Promise<{
  pessoa: PessoaAlvoRecord;
  foto_ok: boolean;
  rota_ok: boolean;
}> {
  let addressId = payload.endereco_id;
  let createdAddressId: string | null = null;

  // Uma correção manual cria um novo registro para não alterar silenciosamente
  // o endereço de outra pessoa ou diligência que compartilhe o endereço antigo.
  if (payload.endereco) {
    const address = await createEndereco(payload.endereco);
    addressId = address.id;
    createdAddressId = address.id;
  }

  const { data, error } = await supabase
    .from("localizacao_pessoas")
    .update({
      ...payload.pessoa,
      endereco_id: addressId,
      telefone: primaryPhone(payload.pessoa.telefones),
    })
    .eq("id", personId)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    if (createdAddressId) {
      await supabase
        .from("localizacao_enderecos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", createdAddressId);
    }
    fail("Falha ao atualizar pessoa", error);
  }

  let person = data as PessoaAlvoRecord;
  let photoOk = !payload.foto;
  if (payload.foto) {
    try {
      const path = await uploadPessoaFoto(person.id, payload.foto);
      person = { ...person, foto_perfil_path: path };
      photoOk = true;
    } catch (uploadError) {
      console.error("[localizacaoRepository] Cadastro atualizado, mas a foto falhou", uploadError);
    }
  }

  let routeOk = !payload.salvar_rota;
  if (payload.salvar_rota && addressId) {
    try {
      const address =
        payload.endereco ?? (await listEnderecos()).find((item) => item.id === addressId);
      const target = address
        ? {
            endereco: formatAddress(address),
            latitude: address.latitude,
            longitude: address.longitude,
            cidade: `${address.municipio}, ${address.uf}`,
          }
        : null;

      if (target) {
        const { error: routeError } = await supabase.from("localizacao_rotas_salvas").insert({
          nome: `Delegacia → ${person.apelido || person.nome}`,
          destino_endereco_id: addressId,
          pessoa_id: person.id,
          google_maps_url: buildMapDirectionsUrl(target, {
            origin: DEFAULT_ROUTE_ORIGIN,
          }),
          waze_url: buildWazeUrl(target),
        });
        if (routeError) throw routeError;
        routeOk = true;
      }
    } catch (routeError) {
      console.error("[localizacaoRepository] Cadastro atualizado, mas a rota falhou", routeError);
    }
  }

  return { pessoa: person, foto_ok: photoOk, rota_ok: routeOk };
}

export async function listRotasSalvas(): Promise<RotaSalvaRecord[]> {
  const { data, error } = await supabase
    .from("localizacao_rotas_salvas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail("Falha ao listar rotas salvas", error);
  return (data ?? []).map((row) => ({
    ...row,
    paradas: Array.isArray(row.paradas) ? row.paradas : [],
  })) as RotaSalvaRecord[];
}

export async function deleteRotaSalva(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("localizacao_rotas_salvas")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) fail("Falha ao excluir rota salva", error);
  if (!data) {
    throw new Error("Rota não encontrada ou sem permissão para exclusão.");
  }
}
