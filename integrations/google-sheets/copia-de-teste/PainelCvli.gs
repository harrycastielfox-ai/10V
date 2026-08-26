const COPIA_TESTE = Object.freeze({
  SPREADSHEET_ID: "1u7d7v4hwCf_Fzf1yqNKQk3bNzFJnl8856J3gZP0FWPw",
  DATA_SHEET: "Controle de Inquéritos",
});

function instalarPainelCvli() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "criarMenuPainelCvli_")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  createCustomMenu();
}

function criarMenuPainelCvli_() {
  createCustomMenu();
}

function abrirDashboardCVLI() {
  exigirCopiaDeTeste_();
  const html = HtmlService.createTemplateFromFile("PainelCvliHtml")
    .evaluate()
    .setWidth(1240)
    .setHeight(760);

  SpreadsheetApp.getUi().showModalDialog(html, "Resumo atualizado de CVLI");
}

const CVLI_MESES = Object.freeze([
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]);

/** Tira acento, quebra de linha e caixa, para comparar cabeçalho e conteúdo. */
function normalizarTexto_(valor) {
  return String(valor == null ? "" : valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Acha a coluna pelo nome do cabeçalho, e não pela letra: assim mover coluna
 * na planilha não quebra o painel.
 */
function acharColuna_(cabecalhos, nome) {
  const alvo = normalizarTexto_(nome);
  const indice = cabecalhos.findIndex((titulo) => normalizarTexto_(titulo) === alvo);
  if (indice < 0) throw new Error(`Coluna ausente na aba ${COPIA_TESTE.DATA_SHEET}: ${nome}`);
  return indice;
}

function anoEMesDoValor_(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return { ano: valor.getFullYear(), mes: valor.getMonth() };
  }

  const texto = String(valor || "").trim();
  const brasileiro = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto);
  if (brasileiro) return { ano: Number(brasileiro[3]), mes: Number(brasileiro[2]) - 1 };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto);
  if (iso) return { ano: Number(iso[1]), mes: Number(iso[2]) - 1 };

  return null;
}

/**
 * Monta o comparativo a partir do Controle de Inquéritos.
 *
 * Registro conta pela DATA DO FATO quando a GRAVIDADE é CVLI. Elucidado é o
 * mesmo registro com STATUS DO PROCEDIMENTO em "Remetido" — "Andamento" não
 * entra. O painel deixou de depender de uma aba de dashboard: os números saem
 * direto dos procedimentos.
 */
function obterDashboardCvli() {
  const spreadsheet = exigirCopiaDeTeste_();
  const sheet = spreadsheet.getSheetByName(COPIA_TESTE.DATA_SHEET);
  if (!sheet) throw new Error(`Aba ausente: ${COPIA_TESTE.DATA_SHEET}`);

  SpreadsheetApp.flush();

  const ultimaLinha = sheet.getLastRow();
  const ultimaColuna = sheet.getLastColumn();
  const cabecalhos = sheet.getRange(1, 1, 1, ultimaColuna).getDisplayValues()[0];
  const colunaData = acharColuna_(cabecalhos, "DATA DO FATO");
  const colunaGravidade = acharColuna_(cabecalhos, "GRAVIDADE");
  const colunaStatus = acharColuna_(cabecalhos, "STATUS DO PROCEDIMENTO");
  const colunaEnvio = acharColuna_(cabecalhos, "DATA ENVIO RELATORIO");

  const linhas =
    ultimaLinha < 2 ? [] : sheet.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();

  const porAno = {};
  linhas.forEach((linha) => {
    if (normalizarTexto_(linha[colunaGravidade]) !== "CVLI") return;

    const quando = anoEMesDoValor_(linha[colunaData]);
    if (!quando) return;

    if (!porAno[quando.ano]) {
      porAno[quando.ano] = {
        registros: CVLI_MESES.map(() => 0),
        elucidados: CVLI_MESES.map(() => 0),
      };
    }

    porAno[quando.ano].registros[quando.mes] += 1;
    if (normalizarTexto_(linha[colunaStatus]) === "REMETIDO") {
      // O elucidado conta no mes da remessa. Sem data de envio, cai no mes do fato.
      const remessa = anoEMesDoValor_(linha[colunaEnvio]) || quando;
      if (!porAno[remessa.ano]) {
        porAno[remessa.ano] = {
          registros: CVLI_MESES.map(() => 0),
          elucidados: CVLI_MESES.map(() => 0),
        };
      }
      porAno[remessa.ano].elucidados[remessa.mes] += 1;
    }
  });

  const anos = Object.keys(porAno)
    .map(Number)
    .sort((a, b) => a - b)
    .slice(-4);

  const linhaAnos = ["MÊS"];
  const linhaMetricas = [""];
  anos.forEach((ano) => {
    linhaAnos.push(String(ano), "");
    linhaMetricas.push("Registros", "Elucidados");
  });

  const linhasMeses = CVLI_MESES.map((mes, indice) => {
    const linha = [mes];
    anos.forEach((ano) => {
      linha.push(porAno[ano].registros[indice], porAno[ano].elucidados[indice]);
    });
    return linha;
  });

  const linhaTotal = ["TOTAL"];
  const linhaTaxa = ["Elucidação (%)"];
  anos.forEach((ano) => {
    const registros = porAno[ano].registros.reduce((soma, valor) => soma + valor, 0);
    const elucidados = porAno[ano].elucidados.reduce((soma, valor) => soma + valor, 0);
    linhaTotal.push(registros, elucidados);
    linhaTaxa.push(registros ? `${Math.round((elucidados / registros) * 100)}%` : "0%", "");
  });

  return {
    valores: [linhaAnos, linhaMetricas].concat(linhasMeses, [linhaTotal, linhaTaxa]),
    atualizadoEm: Utilities.formatDate(
      new Date(),
      spreadsheet.getSpreadsheetTimeZone(),
      "dd/MM/yyyy 'as' HH:mm",
    ),
  };
}

/**
 * Carimba a data em que alguem marcou o procedimento como Remetido.
 *
 * A planilha nao guarda quando o status mudou, e o painel precisa disso: o
 * elucidado conta no mes da remessa, nao no mes do fato. Ao marcar Remetido,
 * grava hoje em DATA ENVIO RELATORIO e "Sim" em RELATORIO ENVIADO?. Ao tirar,
 * limpa os dois.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== COPIA_TESTE.DATA_SHEET) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;
  const linha = e.range.getRow();
  if (linha < 2) return;

  const cabecalhos = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const colunaStatus = acharColuna_(cabecalhos, "STATUS DO PROCEDIMENTO") + 1;
  if (e.range.getColumn() !== colunaStatus) return;

  const colunaEnvio = acharColuna_(cabecalhos, "DATA ENVIO RELATORIO") + 1;
  const colunaRelatorio = acharColuna_(cabecalhos, "RELATORIO ENVIADO?") + 1;
  const remetido = normalizarTexto_(e.range.getValue()) === "REMETIDO";

  if (remetido) {
    const hoje = new Date();
    sheet.getRange(linha, colunaEnvio).setValue(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    sheet.getRange(linha, colunaRelatorio).setValue("Sim");
  } else {
    sheet.getRange(linha, colunaEnvio).clearContent();
    sheet.getRange(linha, colunaRelatorio).setValue("Nao");
  }
}

function exigirCopiaDeTeste_() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (spreadsheet.getId() !== COPIA_TESTE.SPREADSHEET_ID) {
    throw new Error("Este modulo so pode operar na planilha COPIA DE TESTE.");
  }
  return spreadsheet;
}
