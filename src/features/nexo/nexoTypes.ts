export type NexoVinculoStatus =
  "confirmado" | "provavel" | "suspeito" | "nao_confirmado" | "desvinculado";

export type NexoOrganizacaoStatus = "monitoramento" | "ativa" | "inativa" | "indeterminada";

export interface NexoEndereco {
  id: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  municipio: string;
  uf: string;
  ponto_referencia: string | null;
  como_chegar: string | null;
  link_navegacao: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface NexoOrganizacao {
  id: string;
  nome: string;
  sigla: string | null;
  status: NexoOrganizacaoStatus;
  cor: string;
  descricao: string | null;
  area_atuacao: string | null;
  nivel_risco: "baixo" | "moderado" | "alto" | "critico";
  simbolo_path: string | null;
  created_at: string;
}

export interface NexoVinculo {
  id: string;
  organizacao_id: string;
  pessoa_id: string;
  status: NexoVinculoStatus;
  funcao: string | null;
  confianca: number;
  fonte_resumo: string | null;
  desde: string | null;
  ate: string | null;
  superior_vinculo_id: string | null;
  organizacao?: NexoOrganizacao | null;
}

export interface NexoVinculoManagementInput {
  vinculo_id: string;
  pessoa_id: string;
  acao: "atualizar" | "remover" | "transferir";
  organizacao_id: string;
  status: Exclude<NexoVinculoStatus, "desvinculado">;
  funcao: string;
  confianca: number;
  fonte_resumo: string;
  superior_vinculo_id: string | null;
}

export interface NexoHierarquiaEvento {
  id: string;
  organizacao_id: string;
  pessoa_id: string;
  vinculo_id: string;
  tipo: "entrada" | "alteracao" | "saida";
  funcao_anterior: string | null;
  funcao_nova: string | null;
  superior_anterior_nome: string | null;
  superior_novo_nome: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  pessoa_nome: string;
  justificativa: string | null;
  ocorrido_em: string;
  autor?: { nome: string } | null;
}

export interface NexoFoto {
  id: string;
  pessoa_id: string;
  storage_path: string;
  legenda: string | null;
  categoria: "perfil" | "relatorio" | "album";
  capturada_em: string | null;
  url?: string | null;
}

export interface NexoPessoa {
  id: string;
  nome: string;
  apelido: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  naturalidade: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  nome_social: string | null;
  sexo: string | null;
  raca_cor: string | null;
  estado_civil: string | null;
  nacionalidade: string;
  escolaridade: string | null;
  profissao: string | null;
  idade_aproximada: boolean;
  idade_aproximada_valor: number | null;
  em_situacao_rua: boolean;
  usa_tornozeleira: boolean;
  altura_cm: number | null;
  tipo_fisico: string | null;
  estado_aparente: string | null;
  sinais_particulares: string | null;
  documentos_extras: NexoDocumentoExtra[];
  contatos: NexoContato[];
  telefone: string | null;
  observacoes: string | null;
  foto_perfil_path: string | null;
  foto_relatorio_path: string | null;
  foto_perfil_url?: string | null;
  foto_relatorio_url?: string | null;
  endereco_id: string | null;
  usar_local_faccao: boolean;
  endereco?: NexoEndereco | null;
  vinculos: NexoVinculo[];
  fotos: NexoFoto[];
  created_at: string;
}

export interface NexoDocumentoExtra {
  id: string;
  tipo: string;
  numero: string;
}

export interface NexoContato {
  id: string;
  tipo: string;
  valor: string;
  whatsapp: boolean;
}

export interface NexoRegistroVinculado {
  id: string;
  pessoa_id: string | null;
  organizacao_id: string | null;
  inquerito_id: string | null;
  bo_id: string | null;
  observacao: string | null;
  created_at: string;
  inquerito?: { numero_ppe: string | null; tipo: string | null; situacao: string | null } | null;
  bo?: { numero_bo: string; infracao_penal: string; status: string } | null;
}

export interface NexoObservacao {
  id: string;
  pessoa_id: string | null;
  organizacao_id: string | null;
  conteudo: string;
  created_at: string;
  created_by: string;
  autor?: { nome: string | null } | null;
}

export type NexoTerritorioClassificacao =
  "confirmado" | "indicativo" | "disputado" | "historico" | "em_analise";

export type NexoTerritorioCategoria =
  | "area_influencia"
  | "ponto_venda"
  | "ponto_encontro"
  | "esconderijo"
  | "deposito"
  | "rota_operacional"
  | "outro";

export interface NexoMapPoint {
  x: number;
  y: number;
}

export interface NexoTerritorio {
  id: string;
  organizacao_id: string;
  bairro: string;
  categoria: NexoTerritorioCategoria;
  classificacao: NexoTerritorioClassificacao;
  confianca: number;
  fonte_resumo: string | null;
  observacoes: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  municipio: string;
  uf: string;
  ponto_referencia: string | null;
  link_navegacao: string | null;
  pontos: NexoMapPoint[];
  created_at: string;
  updated_at: string;
}

export type NexoTerritorioInput = Pick<
  NexoTerritorio,
  "organizacao_id" | "bairro" | "categoria" | "classificacao" | "confianca" | "pontos"
> & {
  fonte_resumo: string;
  observacoes: string;
  logradouro: string;
  numero: string;
  complemento: string;
  municipio: string;
  uf: string;
  ponto_referencia: string;
  link_navegacao: string;
};

export type NexoVeiculoTipoPosse =
  "posse" | "uso_frequente" | "associado" | "apreendido" | "historico";

export interface NexoVeiculoVinculo {
  id: string;
  veiculo_id: string;
  pessoa_id: string | null;
  organizacao_id: string | null;
  tipo_posse: NexoVeiculoTipoPosse;
  confianca: number;
  fonte_resumo: string | null;
  observacoes: string | null;
  created_at: string;
  veiculo: {
    id: string;
    internal_id: string;
    vehicle_type: string;
    brand_model: string | null;
    color: string | null;
    plate: string | null;
    situation: string | null;
    procedure_number: string | null;
    police_report_number: string | null;
  } | null;
}

export interface NexoPessoaInput {
  nome: string;
  apelido: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  naturalidade: string;
  nome_mae: string;
  nome_pai: string;
  nome_social: string;
  sexo: string;
  raca_cor: string;
  estado_civil: string;
  nacionalidade: string;
  escolaridade: string;
  profissao: string;
  idade_aproximada: boolean;
  idade_aproximada_valor: number | null;
  em_situacao_rua: boolean;
  usa_tornozeleira: boolean;
  altura_cm: number | null;
  tipo_fisico: string;
  estado_aparente: string;
  sinais_particulares: string;
  documentos_extras: NexoDocumentoExtra[];
  contatos: NexoContato[];
  telefone: string;
  observacoes: string;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    municipio: string;
    uf: string;
    ponto_referencia: string;
    como_chegar: string;
    link_navegacao: string;
    latitude: number | null;
    longitude: number | null;
  };
  organizacao_id: string;
  usar_local_faccao: boolean;
  vinculo_status: NexoVinculoStatus;
  vinculo_funcao: string;
  vinculo_confianca: number;
  fonte_resumo: string;
  foto_perfil: File | null;
  foto_relatorio: File | null;
}

export interface NexoOrganizacaoInput {
  nome: string;
  sigla: string;
  status: NexoOrganizacaoStatus;
  cor: string;
  descricao: string;
  area_atuacao: string;
  nivel_risco: NexoOrganizacao["nivel_risco"];
}

export type NexoReportScope =
  | { kind: "geral" }
  | { kind: "organizacao"; organizacaoId: string }
  | { kind: "pessoa"; pessoaId: string };
