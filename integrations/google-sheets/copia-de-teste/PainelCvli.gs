const COPIA_TESTE = Object.freeze({
  SPREADSHEET_ID: "1u7d7v4hwCf_Fzf1yqNKQk3bNzFJnl8856J3gZP0FWPw",
  DASHBOARD_SHEET: "Dashborads CVLI",
  DATA_SHEET: "Controle de Inquéritos",
});

function instalarPainelCvli() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "criarMenuPainelCvli_")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("criarMenuPainelCvli_")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();

  criarMenuPainelCvli_();
}

function criarMenuPainelCvli_() {
  SpreadsheetApp.getUi()
    .createMenu("Painel CVLI")
    .addItem("Abrir dashboard", "abrirDashboardCVLI")
    .addToUi();
}

function abrirDashboardCVLI() {
  exigirCopiaDeTeste_();
  const html = HtmlService.createTemplateFromFile("PainelCvliHtml")
    .evaluate()
    .setWidth(1120)
    .setHeight(720);

  SpreadsheetApp.getUi().showModalDialog(html, "Resumo atualizado de CVLI");
}

function obterDashboardCvli() {
  const spreadsheet = exigirCopiaDeTeste_();
  const sheet = spreadsheet.getSheetByName(COPIA_TESTE.DASHBOARD_SHEET);
  if (!sheet) throw new Error(`Aba ausente: ${COPIA_TESTE.DASHBOARD_SHEET}`);

  SpreadsheetApp.flush();
  return {
    valores: sheet.getRange("A3:I18").getDisplayValues(),
    atualizadoEm: Utilities.formatDate(
      new Date(),
      spreadsheet.getSpreadsheetTimeZone(),
      "dd/MM/yyyy 'as' HH:mm",
    ),
  };
}

function exigirCopiaDeTeste_() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (spreadsheet.getId() !== COPIA_TESTE.SPREADSHEET_ID) {
    throw new Error("Este modulo so pode operar na planilha COPIA DE TESTE.");
  }
  return spreadsheet;
}
