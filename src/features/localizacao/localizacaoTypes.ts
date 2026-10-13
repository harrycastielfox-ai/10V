/**
 * Contrato de dados do módulo Localização Operacional.
 *
 * Os nomes de campo seguem as colunas do Supabase (snake_case), como em
 * `vehicleTypes.ts`. A camada de UI deve consumir estes tipos e nunca declarar
 * formatos próprios — assim a troca do repositório mock pelo Supabase real não
 * exige mudança nenhuma nas telas.
 */

/**
 * Status de diligência ainda existe como conceito no banco (o painel
 * territorial por bairro ainda devolve `diligencias`/`diligencias_ativas`,
 * ver BairroPainelDiligenciaRecord) mesmo depois que a interface de
 * diligências foi removida. O tipo aqui reflete o que a API realmente
 * devolve — não o que a tela usa.
 */
export type DiligenciaStatus =
  "planejada" | "em_deslocamento" | "no_local" | "concluida" | "cancelada";

export type PessoaVinculo = "alvo" | "testemunha" | "vitima" | "informante" | "outro";

/**
 * Um contato telefônico com nome de quem atende. Existe porque nem todo
 * cadastro é uma pessoa — pode ser um comércio, uma loja, um ponto de
 * referência com mais de um número (o dono, o gerente, a portaria...).
 */
export interface PessoaTelefoneContato {
  nome: string;
  numero: string;
}

export type BairroStatus = "pendente" | "confirmado" | "nao_identificado";

export interface BairroOperacionalRecord {
  id: string;
  nome: string;
  chave: string;
  aliases: string[];
  municipio: string;
  uf: string;
  ordem: number;
  centro_latitude: number | null;
  centro_longitude: number | null;
  limite_geojson: Record<string, unknown> | null;
  posicao_confirmada: boolean;
  fonte: string | null;
  ativo: boolean;
}

export interface EnderecoRecord {
  id: string;
  logradouro: string;
  numero: string | null;
  sem_numero: boolean;
  complemento: string | null;
  bairro: string | null;
  /** Referência normalizada ao catálogo territorial. */
  bairro_id: string | null;
  /** Nunca é confirmado automaticamente por texto ou coordenada. */
  bairro_status: BairroStatus;
  bairro_confirmado_em: string | null;
  bairro_confirmado_por: string | null;
  bairro_revisado_em: string | null;
  bairro_revisado_por: string | null;
  municipio: string;
  uf: string;
  cep: string | null;
  ponto_referencia: string | null;
  /**
   * Explicação em texto corrido de como chegar, do jeito que se fala:
   * "porteira azul à direita, 4 km depois do posto, terceira casa".
   * É o campo mais valioso do cadastro — o que nenhum mapa tem.
   */
  como_chegar: string | null;
  /** Preenchidas por geocodificação ou pela confirmação em campo. */
  latitude: number | null;
  longitude: number | null;
  /** Link manual do Google Maps, útil quando a rua ainda não existe nas buscas. */
  maps_url: string | null;
  /** true depois que uma equipe confirmou o local presencialmente. */
  confirmado: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PessoaAlvoRecord {
  id: string;
  nome: string;
  /** Como a pessoa é conhecida. Na prática é por aqui que a busca acontece. */
  apelido: string | null;
  /** Caminho da foto no Supabase Storage (bucket privado, nunca URL pública). */
  foto_perfil_path: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  nome_mae: string | null;
  vinculo: PessoaVinculo;
  /** Espelha telefones[0].numero — mantido pela API para a busca rápida continuar funcionando. */
  telefone: string | null;
  /** Lista completa de contatos telefônicos, com nome de quem atende cada um. */
  telefones: PessoaTelefoneContato[];
  numero_bo: string | null;
  /** Número do procedimento policial usado para cruzar o cadastro com o SIED. */
  numero_procedimento: string | null;
  endereco_id: string | null;
  inquerito_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** Ficha completa carregada somente quando o usuário seleciona uma pessoa. */
export interface PessoaDetalheRecord extends PessoaAlvoRecord {
  endereco: EnderecoRecord | null;
}

/**
 * Resultado da busca "Onde Fica": a pessoa já com o local resolvido.
 * É o formato que a tela de busca e a ficha consomem — evita a UI ter que
 * cruzar pessoa e endereço por conta própria.
 */
export interface PessoaComLocal {
  id: string;
  nome: string;
  apelido: string | null;
  telefone: string | null;
  numero_bo: string | null;
  numero_procedimento: string | null;
  foto_perfil_path: string | null;
  vinculo: PessoaVinculo;
  inquerito_id: string | null;
  endereco: EnderecoRecord | null;
  /** Fotos do local (fachada, entrada, referência), não da pessoa. */
  fotos_local: RegistroFotograficoRecord[];
}

/** Endereço leve usado para montar os bairros no mapa sem carregar fichas pessoais. */
export type MapaEnderecoRecord = Pick<
  EnderecoRecord,
  | "id"
  | "logradouro"
  | "numero"
  | "sem_numero"
  | "bairro"
  | "bairro_id"
  | "bairro_status"
  | "municipio"
  | "uf"
  | "latitude"
  | "longitude"
  | "maps_url"
>;

/** Pessoa carregada sob demanda somente para a área visível ou bairro selecionado. */
export interface MapaPessoaRecord {
  id: string;
  nome: string;
  apelido: string | null;
  foto_perfil_path: string | null;
  vinculo: PessoaVinculo;
  endereco: MapaEnderecoRecord | null;
}

export interface BairroPainelDiligenciaRecord {
  id: string;
  codigo: string;
  status: DiligenciaStatus;
  equipe_nome: string | null;
  agendada_para: string | null;
  destino: string;
}

/** Ficha territorial limitada, carregada apenas depois da selecao de um bairro. */
export interface BairroPainelRecord {
  bairro_id: string;
  bairro_nome: string;
  enderecos_total: number;
  enderecos_posicionados: number;
  pessoas_total: number;
  diligencias_ativas: number;
  enderecos: MapaEnderecoRecord[];
  pessoas: MapaPessoaRecord[];
  diligencias: BairroPainelDiligenciaRecord[];
}

export interface RegistroFotograficoRecord {
  id: string;
  /** Foto tirada durante uma diligência. Nulo quando o local foi cadastrado avulso. */
  diligencia_id: string | null;
  /** Foto do local em si (fachada, entrada, referência) — sobrevive à diligência. */
  endereco_id: string | null;
  storage_path: string;
  legenda: string | null;
  capturada_em: string;
  latitude: number | null;
  longitude: number | null;
  created_by: string | null;
}

export interface RotaSalvaRecord {
  id: string;
  nome: string;
  origem_endereco_id: string | null;
  destino_endereco_id: string | null;
  pessoa_id: string | null;
  paradas: string[];
  distancia_metros: number | null;
  duracao_segundos: number | null;
  google_maps_url: string | null;
  waze_url: string | null;
  created_at: string;
  created_by: string | null;
}

export interface LocalizacaoOverviewStats {
  ativas: number;
  em_deslocamento: number;
  no_local: number;
  concluidas_hoje: number;
  enderecos_cadastrados: number;
  pessoas_cadastradas: number;
  fotos_30_dias: number;
  /** Diligências por dia, para o gráfico da visão geral. */
  por_dia: Array<{ dia: string; total: number }>;
}

export type EnderecoPayload = Omit<
  EnderecoRecord,
  | "id"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "bairro_status"
  | "bairro_confirmado_em"
  | "bairro_confirmado_por"
  | "bairro_revisado_em"
  | "bairro_revisado_por"
> & { bairro_status?: BairroStatus };

export type PessoaAlvoPayload = Omit<
  PessoaAlvoRecord,
  "id" | "created_at" | "updated_at" | "created_by"
>;

export interface PessoaCadastroCompletoPayload {
  /** "telefone" fica de fora de propósito: o repositório deriva de telefones[0]. */
  pessoa: Omit<PessoaAlvoPayload, "endereco_id" | "foto_perfil_path" | "telefone">;
  endereco: EnderecoPayload | null;
  endereco_id: string | null;
  foto: File | null;
  salvar_rota: boolean;
}
