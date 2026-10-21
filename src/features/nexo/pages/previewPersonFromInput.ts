import type { NexoOrganizacao, NexoPessoa, NexoPessoaInput, NexoVinculo } from "../nexoTypes";

export function previewPersonFromInput(
  input: NexoPessoaInput,
  id: string,
  organization: NexoOrganizacao | undefined,
  existing?: NexoPessoa,
): NexoPessoa {
  const addressId =
    !input.em_situacao_rua && !input.usar_local_faccao && input.endereco.logradouro.trim()
      ? existing?.endereco_id || crypto.randomUUID()
      : null;
  const profilePhotoUrl = input.foto_perfil
    ? URL.createObjectURL(input.foto_perfil)
    : existing?.foto_perfil_url || null;
  const reportPhotoUrl = input.foto_relatorio
    ? input.foto_relatorio === input.foto_perfil
      ? profilePhotoUrl
      : URL.createObjectURL(input.foto_relatorio)
    : existing?.foto_relatorio_url || profilePhotoUrl;
  const currentLink = existing?.vinculos.find((link) => link.status !== "desvinculado");
  const destinationLink = existing?.vinculos.find(
    (link) => link.organizacao_id === organization?.id,
  );
  const today = new Date().toISOString().slice(0, 10);
  const links = (existing?.vinculos || []).map((link) => {
    if (link.id === currentLink?.id && (!organization || organization.id !== link.organizacao_id)) {
      return { ...link, status: "desvinculado" as const, superior_vinculo_id: null, ate: today };
    }
    if (link.id !== destinationLink?.id || !organization) return link;
    return {
      ...link,
      status: input.vinculo_status,
      funcao: input.vinculo_funcao || null,
      confianca: input.vinculo_confianca,
      fonte_resumo: input.fonte_resumo || null,
      superior_vinculo_id:
        input.vinculo_status === "desvinculado" || link.id !== currentLink?.id
          ? null
          : link.superior_vinculo_id,
      desde: link.id === currentLink?.id ? link.desde : today,
      ate: input.vinculo_status === "desvinculado" ? today : null,
      organizacao: organization,
    };
  });
  if (organization && !destinationLink) {
    links.push({
      id: crypto.randomUUID(),
      superior_vinculo_id: null,
      pessoa_id: id,
      organizacao_id: organization.id,
      status: input.vinculo_status,
      funcao: input.vinculo_funcao || null,
      confianca: input.vinculo_confianca,
      fonte_resumo: input.fonte_resumo || null,
      desde: today,
      ate: input.vinculo_status === "desvinculado" ? today : null,
      organizacao: organization,
    } satisfies NexoVinculo);
  }
  return {
    id,
    nome: input.nome.trim(),
    apelido: input.apelido || null,
    cpf: input.cpf || null,
    rg: input.rg || null,
    data_nascimento: input.idade_aproximada ? null : input.data_nascimento || null,
    naturalidade: input.naturalidade || null,
    nome_mae: input.nome_mae || null,
    nome_pai: input.nome_pai || null,
    nome_social: input.nome_social || null,
    sexo: input.sexo || null,
    raca_cor: input.raca_cor || null,
    estado_civil: input.estado_civil || null,
    nacionalidade: input.nacionalidade || "Brasileira",
    escolaridade: input.escolaridade || null,
    profissao: input.profissao || null,
    idade_aproximada: input.idade_aproximada,
    idade_aproximada_valor: input.idade_aproximada ? input.idade_aproximada_valor : null,
    em_situacao_rua: input.em_situacao_rua,
    usa_tornozeleira: input.usa_tornozeleira,
    altura_cm: input.altura_cm,
    tipo_fisico: input.tipo_fisico || null,
    estado_aparente: input.estado_aparente || null,
    sinais_particulares: input.sinais_particulares || null,
    documentos_extras: input.documentos_extras,
    contatos: input.contatos,
    telefone: input.telefone || null,
    observacoes: input.observacoes || null,
    foto_perfil_path: existing?.foto_perfil_path || null,
    foto_relatorio_path: existing?.foto_relatorio_path || null,
    foto_perfil_url: profilePhotoUrl,
    foto_relatorio_url: reportPhotoUrl,
    endereco_id: addressId,
    endereco: addressId
      ? {
          id: addressId,
          ...input.endereco,
          numero: input.endereco.numero || null,
          bairro: input.endereco.bairro || null,
          ponto_referencia: input.endereco.ponto_referencia || null,
          como_chegar: input.endereco.como_chegar || null,
          link_navegacao: input.endereco.link_navegacao || null,
        }
      : null,
    usar_local_faccao: input.usar_local_faccao,
    vinculos: links,
    fotos: existing?.fotos || [],
    recursos: existing?.recursos || [],
    created_at: existing?.created_at || new Date().toISOString(),
  };
}
