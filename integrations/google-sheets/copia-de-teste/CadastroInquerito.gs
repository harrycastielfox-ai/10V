const CABECALHOS_INQUERITO_COPIA = Object.freeze([
  "N°  PPE",
  "Nº FÍSICO",
  "PRIOR.",
  "DATA DO FATO",
  "DATA\nINSTAURAÇÃO",
  "DATA LIMITE",
  "TIPIFICAÇÃO",
  "GRAVIDADE",
  "TIPO",
  "RÉU PRESO?",
  "VÍTIMA",
  "AUTOR/\nINVESTIGADO",
  "AUTOR: DET/INDET",
  "NOME DA FACÇÃO",
  "BAIRRO/DISTRITO",
  "MOTIVAÇÃO",
  "Equipe respónsavel",
  "ESCRIVÃO",
  "STATUS\nDO PROCEDIMENTO",
  "DILIGÊNCIAS",
  "Diligências pendentes",
  "Nº PROCESSO\nMEDIDA",
  "RELATÓRIO\nENVIADO?",
  "DATA ENVIO\nRELATÓRIO",
  "OBSERVAÇÕES",
]);

function cadastrarInqueritoCopia(dados) {
  if (!dados || typeof dados !== "object") {
    SpreadsheetApp.getUi().alert(
      "Esta funcao e chamada pelo formulario. Para instalar o painel, execute instalarPainelCvli em PainelCvli.gs.",
    );
    return null;
  }

  const spreadsheet = exigirCopiaDeTeste_();
  const sheet = spreadsheet.getSheetByName(COPIA_TESTE.DATA_SHEET);
  if (!sheet) throw new Error(`Aba ausente: ${COPIA_TESTE.DATA_SHEET}`);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  if (headers.join("\u001f") !== CABECALHOS_INQUERITO_COPIA.join("\u001f")) {
    throw new Error("Os cabecalhos da planilha mudaram. Revise o contrato do cadastro.");
  }

  const dataInstauracao = dataValida_(dados.dataInstauracao);
  const prazoDias = inteiroNaoNegativo_(dados.prazoDias);
  const dataLimite = dados.dataLimite
    ? dataValida_(dados.dataLimite)
    : somarDias_(dataInstauracao, prazoDias);
  const vinculadoFaccao = respostaSim_(dados.vinculadoFaccao);
  const medidaProtetiva = respostaSim_(dados.medidaProtetiva);

  const row = [
    texto_(dados.numeroPpe),
    texto_(dados.numeroFisico),
    texto_(dados.prioridade),
    dataValida_(dados.dataFato),
    dataInstauracao,
    dataLimite,
    texto_(dados.tipificacao),
    texto_(dados.gravidade),
    texto_(dados.tipo),
    texto_(dados.reuPreso),
    texto_(dados.vitima),
    texto_(dados.investigado),
    texto_(dados.autoria),
    vinculadoFaccao ? texto_(dados.nomeFaccao) : "",
    texto_(dados.bairro),
    texto_(dados.motivacao),
    texto_(dados.equipe),
    texto_(dados.escrivao),
    "Andamento",
    texto_(dados.diligencias),
    texto_(dados.diligenciasPendentes),
    medidaProtetiva ? texto_(dados.numeroProcessoMedida) : "",
    "Não",
    "",
    texto_(dados.observacoes),
  ];

  const lastRow = sheet.getLastRow();
  const nextRow = lastRow + 1;
  if (nextRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
  if (lastRow >= 2) {
    const source = sheet.getRange(lastRow, 1, 1, row.length);
    const target = sheet.getRange(nextRow, 1, 1, row.length);
    source.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    source.copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }
  sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
  return { rowNumber: nextRow, dataLimite };
}

function marcarInqueritoComoRemetido(numeroPpe, dataEnvio, numeroFisico) {
  const sheet = exigirCopiaDeTeste_().getSheetByName(COPIA_TESTE.DATA_SHEET);
  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 2).getDisplayValues();
  const matches = values
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => String(row[0]).trim() === String(numeroPpe).trim())
    .filter(({ row }) => !numeroFisico || String(row[1]).trim() === String(numeroFisico).trim());
  if (!matches.length) throw new Error(`PPE nao encontrado: ${numeroPpe}`);
  if (matches.length > 1) {
    throw new Error("Ha mais de um registro com esse PPE. Informe tambem o numero fisico.");
  }

  const rowNumber = matches[0].index + 2;
  sheet.getRange(rowNumber, 19).setValue("Remetido");
  sheet.getRange(rowNumber, 23).setValue("Sim");
  sheet.getRange(rowNumber, 24).setValue(dataEnvio ? dataValida_(dataEnvio) : new Date());
  return rowNumber;
}

function somarDias_(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function dataValida_(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Data invalida: ${value}`);
  return date;
}

function inteiroNaoNegativo_(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error("Prazo deve ser um numero inteiro de dias.");
  return number;
}

function respostaSim_(value) {
  return String(value || "").trim().toLocaleLowerCase("pt-BR") === "sim";
}

function texto_(value) {
  return value == null ? "" : String(value).trim();
}
