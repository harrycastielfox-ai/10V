import { supabase } from "@/lib/supabaseClient";
import type {
  NexoHierarquiaEvento,
  NexoFoto,
  NexoOrganizacao,
  NexoOrganizacaoInput,
  NexoObservacao,
  NexoPessoa,
  NexoPessoaInput,
  NexoTerritorio,
  NexoTerritorioInput,
  NexoVeiculoVinculo,
  NexoVeiculoTipoPosse,
  NexoVinculoStatus,
} from "@/features/nexo/nexoTypes";

const PRIVATE_BUCKET = "nexo-private";

function clean(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function extensionFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]{2,5}$/.test(extension)) return extension;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

async function signedUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function hydratePessoa(pessoa: NexoPessoa): Promise<NexoPessoa> {
  const [fotoPerfil, fotoRelatorio, fotos] = await Promise.all([
    signedUrl(pessoa.foto_perfil_path),
    signedUrl(pessoa.foto_relatorio_path),
    Promise.all(
      (pessoa.fotos ?? []).map(async (foto) => ({
        ...foto,
        url: await signedUrl(foto.storage_path),
      })),
    ),
  ]);
  return {
    ...pessoa,
    foto_perfil_url: fotoPerfil,
    foto_relatorio_url: fotoRelatorio,
    fotos,
  };
}

const PESSOA_SELECT = `
  id, nome, apelido, cpf, rg, data_nascimento, naturalidade, nome_mae, nome_pai,
  nome_social, sexo, raca_cor, estado_civil, nacionalidade, escolaridade, profissao,
  idade_aproximada, idade_aproximada_valor, em_situacao_rua, usa_tornozeleira, altura_cm, tipo_fisico,
  estado_aparente, sinais_particulares, documentos_extras, contatos,
  telefone, observacoes, foto_perfil_path, foto_relatorio_path, endereco_id,
  usar_local_faccao, created_at,
  endereco:localizacao_enderecos (
    id, logradouro, numero, bairro, municipio, uf, ponto_referencia,
    como_chegar, link_navegacao, latitude, longitude
  ),
  vinculos:nexo_vinculos (
    id, organizacao_id, pessoa_id, status, funcao, confianca, fonte_resumo, desde, ate, superior_vinculo_id,
    organizacao:nexo_organizacoes (*)
  ),
  fotos:nexo_fotos (id, pessoa_id, storage_path, legenda, categoria, capturada_em)
`;

export async function listNexoOrganizacoes(): Promise<NexoOrganizacao[]> {
  const { data, error } = await supabase
    .from("nexo_organizacoes")
    .select("*")
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as NexoOrganizacao[];
}

export async function listNexoPessoas(): Promise<NexoPessoa[]> {
  const { data, error } = await supabase
    .from("nexo_pessoas")
    .select(PESSOA_SELECT)
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  return Promise.all(((data ?? []) as unknown as NexoPessoa[]).map(hydratePessoa));
}

export async function listNexoTerritorios(): Promise<NexoTerritorio[]> {
  const { data, error } = await supabase
    .from("nexo_territorios")
    .select(
      "id, organizacao_id, bairro, categoria, classificacao, confianca, fonte_resumo, observacoes, logradouro, numero, complemento, municipio, uf, ponto_referencia, link_navegacao, pontos, created_at, updated_at",
    )
    .is("deleted_at", null)
    .order("bairro");
  if (error) throw error;
  return (data ?? []) as NexoTerritorio[];
}

export async function createNexoTerritorio(input: NexoTerritorioInput): Promise<NexoTerritorio> {
  const { data, error } = await supabase
    .from("nexo_territorios")
    .insert({
      organizacao_id: input.organizacao_id,
      bairro: input.bairro.trim(),
      categoria: input.categoria,
      classificacao: input.classificacao,
      confianca: input.confianca,
      fonte_resumo: clean(input.fonte_resumo),
      observacoes: clean(input.observacoes),
      logradouro: clean(input.logradouro),
      numero: clean(input.numero),
      complemento: clean(input.complemento),
      municipio: input.municipio.trim() || "Itabela",
      uf: input.uf.trim().toUpperCase() || "BA",
      ponto_referencia: clean(input.ponto_referencia),
      link_navegacao: clean(input.link_navegacao),
      pontos: input.pontos,
    })
    .select(
      "id, organizacao_id, bairro, categoria, classificacao, confianca, fonte_resumo, observacoes, logradouro, numero, complemento, municipio, uf, ponto_referencia, link_navegacao, pontos, created_at, updated_at",
    )
    .single();
  if (error) throw error;
  return data as NexoTerritorio;
}

export async function softDeleteNexoTerritorio(id: string) {
  const { data, error } = await supabase.rpc("soft_delete_nexo_territorio", {
    p_territorio_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error("Este local já foi removido ou não está mais disponível.");
}

const VEHICLE_LINK_SELECT = `
  id, veiculo_id, pessoa_id, organizacao_id, tipo_posse, confianca,
  fonte_resumo, observacoes, created_at,
  veiculo:vehicles (
    id, internal_id, vehicle_type, brand_model, color, plate, situation,
    procedure_number, police_report_number
  )
`;

export async function listNexoVeiculosVinculados(): Promise<NexoVeiculoVinculo[]> {
  const { data, error } = await supabase
    .from("nexo_veiculos_vinculos")
    .select(VEHICLE_LINK_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NexoVeiculoVinculo[];
}

export async function createNexoVeiculoVinculo(input: {
  veiculo_id: string;
  pessoa_id?: string;
  organizacao_id?: string;
  tipo_posse: NexoVeiculoTipoPosse;
  confianca: number;
  fonte_resumo: string;
  observacoes: string;
}) {
  const { error } = await supabase.from("nexo_veiculos_vinculos").insert({
    veiculo_id: input.veiculo_id,
    pessoa_id: input.pessoa_id || null,
    organizacao_id: input.organizacao_id || null,
    tipo_posse: input.tipo_posse,
    confianca: input.confianca,
    fonte_resumo: clean(input.fonte_resumo),
    observacoes: clean(input.observacoes),
  });
  if (error) throw error;
}

export async function softDeleteNexoVeiculoVinculo(id: string) {
  const { data, error } = await supabase.rpc("soft_delete_nexo_veiculo_vinculo", {
    p_vinculo_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error("Este vínculo já foi removido ou não está mais disponível.");
}

export async function createNexoOrganizacao(input: NexoOrganizacaoInput): Promise<NexoOrganizacao> {
  const { data, error } = await supabase
    .from("nexo_organizacoes")
    .insert({
      nome: input.nome.trim(),
      sigla: clean(input.sigla),
      status: input.status,
      cor: input.cor,
      descricao: clean(input.descricao),
      area_atuacao: clean(input.area_atuacao),
      nivel_risco: input.nivel_risco,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as NexoOrganizacao;
}

export async function updateNexoOrganizacao(
  id: string,
  input: NexoOrganizacaoInput,
): Promise<NexoOrganizacao> {
  const { data, error } = await supabase
    .from("nexo_organizacoes")
    .update({
      nome: input.nome.trim(),
      sigla: clean(input.sigla),
      status: input.status,
      cor: input.cor,
      descricao: clean(input.descricao),
      area_atuacao: clean(input.area_atuacao),
      nivel_risco: input.nivel_risco,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error) throw error;
  return data as NexoOrganizacao;
}

export async function createNexoVinculo(input: {
  pessoa_id: string;
  organizacao_id: string;
  status: NexoVinculoStatus;
  funcao: string;
  confianca: number;
  fonte_resumo: string;
  superior_vinculo_id?: string | null;
}) {
  const { error } = await supabase.from("nexo_vinculos").insert({
    pessoa_id: input.pessoa_id,
    organizacao_id: input.organizacao_id,
    status: input.status,
    funcao: clean(input.funcao),
    confianca: input.confianca,
    fonte_resumo: clean(input.fonte_resumo),
    superior_vinculo_id:
      input.status === "desvinculado" ? null : (input.superior_vinculo_id ?? null),
  });
  if (error) throw error;
}

export async function manageNexoVinculo(input: {
  vinculo_id: string;
  acao: "atualizar" | "remover" | "transferir";
  organizacao_id?: string;
  status?: NexoVinculoStatus;
  funcao?: string;
  confianca?: number;
  fonte_resumo?: string;
  superior_vinculo_id?: string | null;
}) {
  const { error } = await supabase.rpc("nexo_gerenciar_vinculo", {
    p_vinculo_id: input.vinculo_id,
    p_acao: input.acao,
    p_organizacao_id: input.organizacao_id || null,
    p_status: input.status === "desvinculado" ? "nao_confirmado" : input.status || "nao_confirmado",
    p_funcao: clean(input.funcao || ""),
    p_confianca: input.confianca ?? 0,
    p_fonte_resumo: clean(input.fonte_resumo || ""),
    p_superior_vinculo_id: input.superior_vinculo_id ?? null,
  });
  if (error) throw error;
}

export async function listNexoHierarquiaEventos(scope: {
  pessoa_id?: string;
  organizacao_id?: string;
}): Promise<NexoHierarquiaEvento[]> {
  let query = supabase
    .from("nexo_hierarquia_eventos")
    .select(
      `id, organizacao_id, pessoa_id, vinculo_id, tipo, funcao_anterior,
      funcao_nova, superior_anterior_nome, superior_novo_nome, status_anterior,
      status_novo, pessoa_nome, justificativa, ocorrido_em,
      autor:profiles!nexo_hierarquia_eventos_autor_id_fkey (nome)`,
    )
    .order("ocorrido_em", { ascending: false })
    .limit(100);
  query = scope.pessoa_id
    ? query.eq("pessoa_id", scope.pessoa_id)
    : query.eq("organizacao_id", scope.organizacao_id!);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as NexoHierarquiaEvento[];
}

const OBSERVACAO_SELECT = `
  id, pessoa_id, organizacao_id, conteudo, created_at, created_by,
  autor:profiles!nexo_observacoes_created_by_fkey (nome)
`;

export async function listNexoObservacoes(scope: {
  pessoa_id?: string;
  organizacao_id?: string;
}): Promise<NexoObservacao[]> {
  let query = supabase
    .from("nexo_observacoes")
    .select(OBSERVACAO_SELECT)
    .order("created_at", { ascending: false });
  query = scope.pessoa_id
    ? query.eq("pessoa_id", scope.pessoa_id)
    : query.eq("organizacao_id", scope.organizacao_id || "");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as NexoObservacao[];
}

export async function createNexoObservacao(input: {
  pessoa_id?: string;
  organizacao_id?: string;
  conteudo: string;
}): Promise<NexoObservacao> {
  const { data, error } = await supabase
    .from("nexo_observacoes")
    .insert({
      pessoa_id: input.pessoa_id || null,
      organizacao_id: input.organizacao_id || null,
      conteudo: input.conteudo.trim(),
    })
    .select(OBSERVACAO_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as NexoObservacao;
}

async function uploadPessoaImage(personId: string, file: File, category: "perfil" | "relatorio") {
  const path = `pessoas/${personId}/${category}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const column = category === "perfil" ? "foto_perfil_path" : "foto_relatorio_path";
  const { error: updateError } = await supabase
    .from("nexo_pessoas")
    .update({ [column]: path })
    .eq("id", personId);
  if (updateError) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([path]);
    throw updateError;
  }
  return path;
}

export async function createNexoPessoa(input: NexoPessoaInput): Promise<string> {
  const { data, error } = await supabase.rpc("nexo_criar_pessoa_completa", {
    p_payload: {
      pessoa: {
        nome: input.nome.trim(),
        apelido: clean(input.apelido),
        cpf: clean(input.cpf),
        rg: clean(input.rg),
        data_nascimento: input.idade_aproximada ? null : input.data_nascimento || null,
        naturalidade: clean(input.naturalidade),
        nome_mae: clean(input.nome_mae),
        nome_pai: clean(input.nome_pai),
        telefone: clean(input.telefone),
        observacoes: clean(input.observacoes),
        usar_local_faccao: input.usar_local_faccao,
      },
      endereco:
        !input.em_situacao_rua && !input.usar_local_faccao && input.endereco.logradouro.trim()
          ? {
              ...input.endereco,
              numero: clean(input.endereco.numero),
              bairro: clean(input.endereco.bairro),
              ponto_referencia: clean(input.endereco.ponto_referencia),
              como_chegar: clean(input.endereco.como_chegar),
              link_navegacao: clean(input.endereco.link_navegacao),
            }
          : null,
      vinculo: input.organizacao_id
        ? {
            organizacao_id: input.organizacao_id,
            status: input.vinculo_status,
            funcao: clean(input.vinculo_funcao),
            confianca: input.vinculo_confianca,
            fonte_resumo: clean(input.fonte_resumo),
          }
        : null,
    },
  });
  if (error) throw error;
  const personId = String(data);
  const { error: profileError } = await supabase
    .from("nexo_pessoas")
    .update({
      nome_social: clean(input.nome_social),
      sexo: clean(input.sexo),
      raca_cor: clean(input.raca_cor),
      estado_civil: clean(input.estado_civil),
      nacionalidade: input.nacionalidade.trim() || "Brasileira",
      escolaridade: clean(input.escolaridade),
      profissao: clean(input.profissao),
      idade_aproximada: input.idade_aproximada,
      idade_aproximada_valor: input.idade_aproximada ? input.idade_aproximada_valor : null,
      em_situacao_rua: input.em_situacao_rua,
      usa_tornozeleira: input.usa_tornozeleira,
      altura_cm: input.altura_cm,
      tipo_fisico: clean(input.tipo_fisico),
      estado_aparente: clean(input.estado_aparente),
      sinais_particulares: clean(input.sinais_particulares),
      documentos_extras: input.documentos_extras,
      contatos: input.contatos,
    })
    .eq("id", personId);
  if (profileError) throw profileError;
  if (input.foto_perfil) {
    const path = await uploadPessoaImage(personId, input.foto_perfil, "perfil");
    const { error: reportPhotoError } = await supabase
      .from("nexo_pessoas")
      .update({ foto_relatorio_path: path })
      .eq("id", personId);
    if (reportPhotoError) throw reportPhotoError;
  }
  return personId;
}

export async function updateNexoPessoa(current: NexoPessoa, input: NexoPessoaInput): Promise<void> {
  let enderecoId = current.endereco_id;
  const hasOwnAddress =
    !input.em_situacao_rua && !input.usar_local_faccao && Boolean(input.endereco.logradouro.trim());

  if (hasOwnAddress) {
    const enderecoPayload = {
      logradouro: input.endereco.logradouro.trim(),
      numero: clean(input.endereco.numero),
      bairro: clean(input.endereco.bairro),
      municipio: input.endereco.municipio.trim() || "Itabela",
      uf: input.endereco.uf.trim().toUpperCase() || "BA",
      ponto_referencia: clean(input.endereco.ponto_referencia),
      como_chegar: clean(input.endereco.como_chegar),
      link_navegacao: clean(input.endereco.link_navegacao),
      latitude: input.endereco.latitude,
      longitude: input.endereco.longitude,
    };
    if (enderecoId) {
      const { error } = await supabase
        .from("localizacao_enderecos")
        .update(enderecoPayload)
        .eq("id", enderecoId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("localizacao_enderecos")
        .insert(enderecoPayload)
        .select("id")
        .single();
      if (error) throw error;
      enderecoId = data.id;
    }
  } else {
    enderecoId = null;
  }

  const { error: personError } = await supabase
    .from("nexo_pessoas")
    .update({
      nome: input.nome.trim(),
      apelido: clean(input.apelido),
      cpf: clean(input.cpf),
      rg: clean(input.rg),
      data_nascimento: input.idade_aproximada ? null : input.data_nascimento || null,
      naturalidade: clean(input.naturalidade),
      nome_mae: clean(input.nome_mae),
      nome_pai: clean(input.nome_pai),
      nome_social: clean(input.nome_social),
      sexo: clean(input.sexo),
      raca_cor: clean(input.raca_cor),
      estado_civil: clean(input.estado_civil),
      nacionalidade: input.nacionalidade.trim() || "Brasileira",
      escolaridade: clean(input.escolaridade),
      profissao: clean(input.profissao),
      idade_aproximada: input.idade_aproximada,
      idade_aproximada_valor: input.idade_aproximada ? input.idade_aproximada_valor : null,
      em_situacao_rua: input.em_situacao_rua,
      usa_tornozeleira: input.usa_tornozeleira,
      altura_cm: input.altura_cm,
      tipo_fisico: clean(input.tipo_fisico),
      estado_aparente: clean(input.estado_aparente),
      sinais_particulares: clean(input.sinais_particulares),
      documentos_extras: input.documentos_extras,
      contatos: input.contatos,
      telefone: clean(input.telefone),
      observacoes: clean(input.observacoes),
      endereco_id: enderecoId,
      usar_local_faccao: input.usar_local_faccao,
    })
    .eq("id", current.id)
    .is("deleted_at", null);
  if (personError) throw personError;

  const currentLink = current.vinculos.find((link) => link.status !== "desvinculado");
  if (input.organizacao_id && currentLink) {
    if (
      input.organizacao_id !== currentLink.organizacao_id &&
      input.vinculo_status !== "desvinculado"
    ) {
      await manageNexoVinculo({
        vinculo_id: currentLink.id,
        acao: "transferir",
        organizacao_id: input.organizacao_id,
        status: input.vinculo_status,
        funcao: input.vinculo_funcao,
        confianca: input.vinculo_confianca,
        fonte_resumo: input.fonte_resumo,
        superior_vinculo_id: null,
      });
    } else {
      await manageNexoVinculo({
        vinculo_id: currentLink.id,
        acao: input.vinculo_status === "desvinculado" ? "remover" : "atualizar",
        status: input.vinculo_status,
        funcao: input.vinculo_funcao,
        confianca: input.vinculo_confianca,
        fonte_resumo: input.fonte_resumo,
        superior_vinculo_id: currentLink.superior_vinculo_id,
      });
    }
  } else if (input.organizacao_id) {
    const historicalLink = current.vinculos.find(
      (link) => link.organizacao_id === input.organizacao_id,
    );
    if (historicalLink) {
      await manageNexoVinculo({
        vinculo_id: historicalLink.id,
        acao: input.vinculo_status === "desvinculado" ? "remover" : "atualizar",
        status: input.vinculo_status,
        funcao: input.vinculo_funcao,
        confianca: input.vinculo_confianca,
        fonte_resumo: input.fonte_resumo,
      });
    } else {
      await createNexoVinculo({
        pessoa_id: current.id,
        organizacao_id: input.organizacao_id,
        status: input.vinculo_status,
        funcao: input.vinculo_funcao,
        confianca: input.vinculo_confianca,
        fonte_resumo: input.fonte_resumo,
      });
    }
  } else if (currentLink) {
    await manageNexoVinculo({ vinculo_id: currentLink.id, acao: "remover" });
  }

  if (input.foto_perfil) {
    const path = await uploadPessoaImage(current.id, input.foto_perfil, "perfil");
    const { error } = await supabase
      .from("nexo_pessoas")
      .update({ foto_relatorio_path: path })
      .eq("id", current.id);
    if (error) throw error;
  }
}

export async function uploadNexoAlbumPhoto(
  personId: string,
  file: File,
  legenda: string,
): Promise<NexoFoto> {
  const path = `pessoas/${personId}/album/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error: uploadError } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("nexo_fotos")
    .insert({
      pessoa_id: personId,
      storage_path: path,
      legenda: clean(legenda),
      categoria: "album",
    })
    .select("id, pessoa_id, storage_path, legenda, categoria, capturada_em")
    .single();
  if (error) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([path]);
    throw error;
  }
  return { ...(data as NexoFoto), url: await signedUrl(path) };
}
