/**
 * Sistema oficial de gestão de Boletins de Ocorrência.
 * Planilha: EDUARDO DIAS - B.O/IP
 *
 * Este arquivo deve ser colado em Extensões > Apps Script > Boletins.gs.
 * O arquivo BoApp.html precisa ser criado no mesmo projeto Apps Script.
 */

const BO_APP = Object.freeze({
  VERSION: "1.4.0",

  SPREADSHEET_ID: "1D06WzYW2ObHjY2V7erfIWCjgh82LPhcC7mCGwyAmbEQ",

  BASE_SHEET: "BOLETINS DE OCORRÊNCIA",

  AUDIT_SHEET: "_BO_AUDITORIA",
  CATALOG_SHEET: "_BO_CATALOGOS",

  /**
   * Colunas do módulo, na ordem em que ficam na aba.
   * A partir da 1.4.0 quem manda é a aba: coluna removida do fim tira o campo
   * do cadastro, em vez de derrubar o módulo inteiro. Hoje isso vale para
   * STATUS, que é a última.
   */
  HEADERS: Object.freeze([
    "Nº B.O.",
    "INFRAÇÃO PENAL",
    "DILIGÊNCIAS PENDENTES",
    "RESPONSÁVEL PELO PROCEDIMENTO",
    "OBSERVAÇÃO",
    "STATUS",
  ]),

  /** Sem estas duas não há registro que se sustente. */
  MINIMO_COLUNAS: 2,

  STATUSES: Object.freeze([
    "Pendente",
    "Em Andamento",
    "Agendada",
    "Aguardando Terceiros",
    "Concluída",
    "Cancelada",
    "Suspensa",
    "Aguardando Aprovação/Revisão",
  ]),
  DEFAULT_STATUS: "Pendente",
  DATA_ROW_HEIGHT: 28,
  MAX_RESULTS: 100,
});

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("⚖️ CADASTRAR")
    .addItem("➕ Cadastrar B.O.", "abrirCadastroBo")
    .addItem("📁 Cadastrar Inquérito", "abrirCadastroInquerito")
    .addSeparator()
    .addItem("❌ Excluir B.O.", "abrirExcluirBo")
    .addToUi();

  ui.createMenu("🔍 PESQUISAR")
    .addItem("Buscar B.O.", "abrirPesquisaBo")
    .addItem("Buscar Inquérito", "abrirPesquisaInquerito")
    .addToUi();
}

function onInstall() {
  onOpen();
}

function onEdit(evento) {
  if (!evento || !evento.range) return;
  const intervalo = evento.range;
  const base = intervalo.getSheet();
  if (base.getName() !== BO_APP.BASE_SHEET || intervalo.getLastRow() < 2) return;

  const primeiraLinha = Math.max(2, intervalo.getRow());
  const quantidade = intervalo.getLastRow() - primeiraLinha + 1;
  base.setRowHeightsForced(primeiraLinha, quantidade, BO_APP.DATA_ROW_HEIGHT);
}

function abrirCadastroBo() {
  abrirAplicativoBo_("novo");
}

function abrirEditarBo() {
  abrirAplicativoBo_("editar");
}

function abrirExcluirBo() {
  abrirAplicativoBo_("excluir");
}

function abrirPesquisaBo() {
  abrirAplicativoBo_("pesquisar");
}

function abrirAplicativoBo_(modo) {
  const base = exigirBaseOficial_();
  const titulos = {
    novo: "Cadastrar B.O.",
    editar: "Editar B.O.",
    excluir: "Excluir B.O.",
    pesquisar: "Pesquisar B.O.",
  };
  if (!titulos[modo]) throw new Error("Modo de abertura inválido.");

  const template = HtmlService.createTemplateFromFile("BoApp");
  template.contexto = {
    modo,
    titulo: titulos[modo],
    versao: BO_APP.VERSION,
    /* Campo cuja coluna não existe sai da tela, em vez de ser preenchido
       e descartado sem aviso na hora de gravar. */
    presentes: { STATUS: boTemStatus_(base) },
  };
  const html = template.evaluate().setWidth(1060).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, titulos[modo]);
}

/**
 * Pesquisa parcial. Cada filtro preenchido precisa corresponder ao registro,
 * mas aceita apenas um trecho do valor e ignora acentos/maiúsculas.
 */
function buscarBos(filtros) {
  const termos = normalizarFiltros_(filtros);
  if (!Object.values(termos).some(Boolean)) {
    throw new Error("Preencha ao menos uma informação para pesquisar.");
  }

  const base = exigirBaseOficial_();
  const largura = boLargura_(base);
  const ultimaLinha = base.getLastRow();
  if (ultimaLinha < 2) return { total: 0, limitado: false, itens: [] };

  const valores = base.getRange(2, 1, ultimaLinha - 1, largura).getDisplayValues();
  const encontrados = [];
  let total = 0;

  valores.forEach((linha, indice) => {
    if (linha.every((valor) => !String(valor).trim())) return;
    const registro = linhaParaRegistro_(linha, indice + 2);
    if (!registroCorresponde_(registro, termos)) return;
    total += 1;
    if (encontrados.length < BO_APP.MAX_RESULTS) encontrados.push(resumoRegistro_(registro));
  });

  return {
    total,
    limitado: total > BO_APP.MAX_RESULTS,
    itens: encontrados,
  };
}

function obterBo(linha, numeroEsperado) {
  const base = exigirBaseOficial_();
  const numeroLinha = validarLinha_(linha, base);
  const valores = base.getRange(numeroLinha, 1, 1, boLargura_(base)).getDisplayValues()[0];
  if (valores.every((valor) => !String(valor).trim())) {
    throw new Error("O registro selecionado está vazio ou não existe mais.");
  }
  if (
    numeroEsperado &&
    normalizarTexto_(valores[0]) !== normalizarTexto_(numeroEsperado)
  ) {
    throw new Error("A lista de resultados ficou desatualizada. Faça a pesquisa novamente.");
  }
  return registroCompleto_(linhaParaRegistro_(valores, numeroLinha));
}

/**
 * Cadastra ou atualiza um B.O. O token impede que uma tela antiga sobrescreva
 * uma alteração feita por outra pessoa enquanto o formulário estava aberto.
 */
function salvarBo(dados) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const base = exigirBaseOficial_();
    const largura = boLargura_(base);
    const registro = validarDadosBo_(dados);

    /* Sem coluna STATUS o campo não entra no registro nem no token. Sem isto,
       a tela mandaria "Pendente", o registro salvo teria status vazio, e toda
       edição acusaria "alterado por outra pessoa" sem ninguém ter alterado. */
    if (!boTemStatus_(base)) registro.status = "";

    let linha;
    let acao;

    if (registro.linha) {
      linha = validarLinha_(registro.linha, base);
      exigirRegistroInalterado_(base, linha, registro.token);
      impedirNumeroDuplicado_(base, registro.numero, linha);
      acao = "EDIÇÃO";
    } else {
      impedirNumeroDuplicado_(base, registro.numero, null);
      linha = encontrarLinhaLivre_(base);
      acao = "CADASTRO";
    }

    const valores = [[
      registro.numero,
      registro.infracao,
      registro.diligencias,
      registro.responsavel,
      registro.observacao,
      registro.status,
    ].slice(0, largura)];

    base.getRange(linha, 1).setNumberFormat("@");
    base.getRange(linha, 1, 1, largura).setValues(valores);
    if (largura >= 5) base.getRange(linha, 5).setNumberFormat("@");
    base.setRowHeightsForced(linha, 1, BO_APP.DATA_ROW_HEIGHT);
    SpreadsheetApp.flush();

    try {
      registrarSugestoesPersonalizadas_(registro);
    } catch (erroCatalogo) {
      console.warn(`Não foi possível atualizar o catálogo: ${erroCatalogo.message}`);
    }
    registrarAuditoria_(acao, linha, valores[0]);
    return {
      mensagem: acao === "CADASTRO"
        ? `B.O. ${registro.numero} cadastrado com sucesso.`
        : `B.O. ${registro.numero} atualizado com sucesso.`,
      registro: obterBo(linha),
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Exclui somente após o cliente confirmar. Antes disso, grava todos os dados
 * na auditoria, permitindo recuperação manual se houver engano.
 */
function excluirBo(dados) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const base = exigirBaseOficial_();
    const linha = validarLinha_(dados && dados.linha, base);
    exigirRegistroInalterado_(base, linha, dados && dados.token);
    const valores = base.getRange(linha, 1, 1, boLargura_(base)).getDisplayValues()[0];
    const numero = String(valores[0] || "").trim();
    if (!numero) throw new Error("O registro selecionado não existe mais.");

    registrarAuditoria_("EXCLUSÃO", linha, valores);
    base.deleteRow(linha);
    SpreadsheetApp.flush();

    return { mensagem: `B.O. ${numero} excluído com sucesso.` };
  } finally {
    lock.releaseLock();
  }
}

function exigirPlanilhaOficial_() {
  const planilha = SpreadsheetApp.getActive();
  if (planilha.getId() !== BO_APP.SPREADSHEET_ID) {
    throw new Error(
      "Este script só pode ser usado na planilha oficial de B.O.\n\n" +
      `Esperado: ${BO_APP.SPREADSHEET_ID}\n` +
      `Encontrado: ${planilha.getId()}\n\n` +
      "Ajuste SPREADSHEET_ID em BO_APP se esta for a planilha correta.",
    );
  }
  return planilha;
}

/**
 * Quantas das colunas do módulo existem de fato na aba.
 * Conta pelo cabeçalho, e não por getLastColumn(): dado solto numa coluna
 * à direita não pode fazer o módulo achar que existe coluna que não existe.
 */
function boLargura_(base) {
  const total = Math.min(Math.max(base.getLastColumn(), 1), BO_APP.HEADERS.length);
  const cabecalhos = base.getRange(1, 1, 1, total).getDisplayValues()[0];
  let largura = 0;
  while (largura < total && String(cabecalhos[largura]).trim()) largura += 1;
  return largura;
}

/** A aba tem a coluna STATUS? É a última, e pode ter sido removida. */
function boTemStatus_(base) {
  return boLargura_(base) >= BO_APP.HEADERS.length;
}

function exigirBaseOficial_() {
  const planilha = exigirPlanilhaOficial_();
  const base = planilha.getSheetByName(BO_APP.BASE_SHEET);
  if (!base) {
    const abas = planilha.getSheets().map((aba) => `“${aba.getName()}”`).join(", ");
    throw new Error(
      `A aba obrigatória “${BO_APP.BASE_SHEET}” não foi encontrada.\n\n` +
      `Abas existentes: ${abas}\n\n` +
      "Ajuste BASE_SHEET em BO_APP se a aba tiver outro nome.",
    );
  }

  /* Valida só as colunas que existem, na ordem esperada. */
  const largura = boLargura_(base);
  if (largura < BO_APP.MINIMO_COLUNAS) {
    throw new Error(
      `A aba “${BO_APP.BASE_SHEET}” precisa ter ao menos as colunas ` +
      `“${BO_APP.HEADERS[0]}” e “${BO_APP.HEADERS[1]}”.`,
    );
  }

  const cabecalhos = base.getRange(1, 1, 1, largura).getDisplayValues()[0];
  BO_APP.HEADERS.slice(0, largura).forEach((esperado, indice) => {
    if (normalizarTexto_(cabecalhos[indice]) !== normalizarTexto_(esperado)) {
      throw new Error(
        `A coluna ${indice + 1} deveria ser “${esperado}”, mas contém “${cabecalhos[indice]}”.`,
      );
    }
  });
  return base;
}

function normalizarFiltros_(filtros) {
  const fonte = filtros || {};
  return {
    numero: normalizarTexto_(fonte.numero),
    status: normalizarTexto_(fonte.status),
    infracao: normalizarTexto_(fonte.infracao),
    diligencias: normalizarTexto_(fonte.diligencias),
    responsavel: normalizarTexto_(fonte.responsavel),
    observacao: normalizarTexto_(fonte.observacao),
  };
}

function registroCorresponde_(registro, termos) {
  return Object.keys(termos).every((campo) => {
    if (!termos[campo]) return true;
    return normalizarTexto_(registro[campo]).includes(termos[campo]);
  });
}

function linhaParaRegistro_(linha, numeroLinha) {
  return {
    linha: numeroLinha,
    numero: String(linha[0] || "").trim(),
    infracao: String(linha[1] || "").trim(),
    diligencias: String(linha[2] || "").trim(),
    responsavel: String(linha[3] || "").trim(),
    observacao: String(linha[4] || "").trim(),
    /* Sem coluna STATUS o campo fica vazio de verdade, e não com o padrão:
       o token de edição compara este valor com o que a tela devolve. */
    status: linha.length > 5 ? statusLido_(linha[5]) : "",
  };
}

function resumoRegistro_(registro) {
  return {
    linha: registro.linha,
    numero: registro.numero,
    status: registro.status,
    infracao: registro.infracao,
    responsavel: registro.responsavel,
  };
}

function registroCompleto_(registro) {
  return {
    ...registro,
    token: gerarToken_(registro),
  };
}

function validarDadosBo_(dados) {
  const fonte = dados || {};
  const registro = {
    linha: fonte.linha ? Number(fonte.linha) : null,
    token: String(fonte.token || ""),
    numero: limparCampo_(fonte.numero, 120),
    status: validarStatus_(fonte.status),
    infracao: limparCampo_(fonte.infracao, 1000),
    diligencias: limparCampo_(fonte.diligencias, 5000),
    responsavel: limparCampo_(fonte.responsavel, 300),
    observacao: limparCampo_(fonte.observacao, 5000),
  };
  if (!registro.numero) throw new Error("Informe o número do B.O.");
  if (!registro.infracao) throw new Error("Informe a infração penal.");
  if (registro.linha && !registro.token) {
    throw new Error("A tela de edição expirou. Pesquise e abra o B.O. novamente.");
  }
  return registro;
}

function limparCampo_(valor, limite) {
  const texto = String(valor === null || valor === undefined ? "" : valor)
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (texto.length > limite) {
    throw new Error(`Um dos campos ultrapassou o limite de ${limite} caracteres.`);
  }
  return texto;
}

function validarStatus_(valor) {
  const informado = limparCampo_(valor, 80) || BO_APP.DEFAULT_STATUS;
  const alvo = normalizarTexto_(informado);
  const status = BO_APP.STATUSES.find((opcao) => normalizarTexto_(opcao) === alvo);
  if (!status) {
    throw new Error(`Selecione um status válido: ${BO_APP.STATUSES.join(", ")}.`);
  }
  return status;
}

function statusLido_(valor) {
  const informado = String(valor || "").trim();
  if (!informado) return BO_APP.DEFAULT_STATUS;
  const alvo = normalizarTexto_(informado);
  return BO_APP.STATUSES.find((opcao) => normalizarTexto_(opcao) === alvo) || informado;
}

function impedirNumeroDuplicado_(base, numero, linhaIgnorada) {
  const ultimaLinha = base.getLastRow();
  if (ultimaLinha < 2) return;
  const alvo = normalizarTexto_(numero);
  const numeros = base.getRange(2, 1, ultimaLinha - 1, 1).getDisplayValues();
  numeros.forEach((valor, indice) => {
    const linha = indice + 2;
    if (linha === linhaIgnorada) return;
    if (normalizarTexto_(valor[0]) === alvo) {
      throw new Error(`O B.O. ${numero} já está cadastrado na linha ${linha}.`);
    }
  });
}

function encontrarLinhaLivre_(base) {
  const ultimaLinha = base.getLastRow();
  if (ultimaLinha >= 2) {
    const linhas = base.getRange(2, 1, ultimaLinha - 1, boLargura_(base)).getDisplayValues();
    const vazio = linhas.findIndex((linha) => linha.every((valor) => !String(valor).trim()));
    if (vazio >= 0) return vazio + 2;
  }
  const proxima = Math.max(2, ultimaLinha + 1);
  if (proxima > base.getMaxRows()) base.insertRowsAfter(base.getMaxRows(), 100);
  return proxima;
}

function validarLinha_(linha, base) {
  const numero = Number(linha);
  if (!Number.isInteger(numero) || numero < 2 || numero > base.getLastRow()) {
    throw new Error("A linha selecionada é inválida ou não existe mais.");
  }
  return numero;
}

function exigirRegistroInalterado_(base, linha, token) {
  const valores = base.getRange(linha, 1, 1, boLargura_(base)).getDisplayValues()[0];
  const atual = linhaParaRegistro_(valores, linha);
  if (!String(token || "") || gerarToken_(atual) !== String(token)) {
    throw new Error(
      "Este B.O. foi alterado depois que a tela foi aberta. Pesquise novamente antes de continuar.",
    );
  }
}

function gerarToken_(registro) {
  const conteudo = [
    registro.linha,
    registro.numero,
    registro.status,
    registro.infracao,
    registro.diligencias,
    registro.responsavel,
    registro.observacao,
  ].join("␟");
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, conteudo)
    .map((byte) => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0"))
    .join("");
}

function registrarAuditoria_(acao, linha, valores) {
  const planilha = exigirPlanilhaOficial_();
  const auditoria = prepararAuditoria_(planilha);

  auditoria.appendRow([
    new Date(),
    Session.getActiveUser().getEmail() || "Usuário não identificado",
    acao,
    linha,
    ...valores,
  ]);
}

function prepararAuditoria_(planilha) {
  const cabecalhos = ["DATA/HORA", "USUÁRIO", "AÇÃO", "LINHA", ...BO_APP.HEADERS];
  let auditoria = planilha.getSheetByName(BO_APP.AUDIT_SHEET);

  if (!auditoria) {
    auditoria = planilha.insertSheet(BO_APP.AUDIT_SHEET);
  } else if (auditoria.getLastRow() >= 1) {
    const larguraAtual = Math.min(auditoria.getLastColumn(), cabecalhos.length);
    const atuais = auditoria.getRange(1, 1, 1, larguraAtual).getDisplayValues()[0];
    const decimoCabecalho = normalizarTexto_(atuais[9]);
    if (decimoCabecalho && decimoCabecalho !== normalizarTexto_("STATUS")) {
      throw new Error("A estrutura da aba de auditoria não corresponde ao sistema de B.O.");
    }
  }

  auditoria.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
  auditoria.setFrozenRows(1);
  if (!auditoria.isSheetHidden()) auditoria.hideSheet();
  return auditoria;
}

function obterSugestoesPersonalizadas() {
  const planilha = exigirPlanilhaOficial_();
  const catalogo = planilha.getSheetByName(BO_APP.CATALOG_SHEET);
  const resposta = { infracoes: [], diligencias: [] };
  if (!catalogo || catalogo.getLastRow() < 2) return resposta;

  const valores = catalogo.getRange(2, 1, catalogo.getLastRow() - 1, 2).getDisplayValues();
  valores.forEach(([tipo, valor]) => {
    const texto = String(valor || "").trim();
    if (!texto) return;
    if (tipo === "INFRAÇÃO") resposta.infracoes.push(texto);
    if (tipo === "DILIGÊNCIA") resposta.diligencias.push(texto);
  });
  return resposta;
}

function registrarSugestoesPersonalizadas_(registro) {
  const planilha = exigirPlanilhaOficial_();
  const catalogo = prepararCatalogo_(planilha);
  const ultimaLinha = catalogo.getLastRow();
  const existentes = ultimaLinha < 2
    ? []
    : catalogo.getRange(2, 1, ultimaLinha - 1, 2).getDisplayValues();
  const chaves = new Set(
    existentes.map(([tipo, valor]) => `${tipo}␟${normalizarTexto_(valor)}`),
  );
  const novasLinhas = [];

  [
    ["INFRAÇÃO", registro.infracao],
    ["DILIGÊNCIA", registro.diligencias],
  ].forEach(([tipo, conteudo]) => {
    extrairItensCatalogaveis_(conteudo).forEach((valor) => {
      const chave = `${tipo}␟${normalizarTexto_(valor)}`;
      if (chaves.has(chave)) return;
      chaves.add(chave);
      novasLinhas.push([tipo, valor, new Date()]);
    });
  });

  if (novasLinhas.length) {
    catalogo.getRange(catalogo.getLastRow() + 1, 1, novasLinhas.length, 3).setValues(novasLinhas);
  }
}

function prepararCatalogo_(planilha) {
  let catalogo = planilha.getSheetByName(BO_APP.CATALOG_SHEET);
  if (!catalogo) catalogo = planilha.insertSheet(BO_APP.CATALOG_SHEET);
  catalogo.getRange(1, 1, 1, 3).setValues([["TIPO", "VALOR", "CRIADO EM"]]);
  catalogo.setFrozenRows(1);
  if (!catalogo.isSheetHidden()) catalogo.hideSheet();
  return catalogo;
}

function extrairItensCatalogaveis_(conteudo) {
  return String(conteudo || "")
    .split(/\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => podeCatalogar_(item));
}

function podeCatalogar_(texto) {
  if (texto.length < 4 || texto.length > 1000) return false;
  if (/\b(?:cpf|rg|telefone|celular|e-mail|email|endereço|filiacao|filiação)\b/i.test(texto)) return false;
  if (/\b\d{8,}\b/.test(texto) || /@/.test(texto)) return false;
  if (/\b(?:sr|sra|senhor|senhora|dr|dra)\.?\s+[A-ZÀ-Ý]/i.test(texto)) return false;
  if (/\b(?:de|do|da|dos|das|contra|vítima|vitima|autor|investigado|testemunha)\s+[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+(?:de|da|do|dos|das))?\s+[A-ZÀ-Ý][a-zà-ÿ]+/.test(texto)) return false;
  return true;
}

function normalizarAlturaLinhasBo() {
  const base = exigirBaseOficial_();
  const quantidade = base.getMaxRows() - 1;
  if (quantidade > 0) {
    base.setRowHeightsForced(2, quantidade, BO_APP.DATA_ROW_HEIGHT);
  }
  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast("Altura das linhas normalizada.", "B.O.", 4);
}

function normalizarTexto_(valor) {
  return String(valor === null || valor === undefined ? "" : valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
