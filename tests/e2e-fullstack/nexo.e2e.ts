import type { Locator, Page, Response } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { expect, syntheticUser, test } from "./fixtures";
import { onePagePdf } from "../support/syntheticPdf";

test.setTimeout(120_000);

async function submitLogin(page: Page, login: string, password: string) {
  await page.goto("/login");
  await page.locator("#usuario").fill(login);
  await page.locator("#senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/modulos$/);
}

function isNexoRpc(response: Response, rpcName: string) {
  const url = new URL(response.url());
  return response.request().method() === "POST" && url.pathname === `/rest/v1/rpc/${rpcName}`;
}

function readStoredZip(buffer: Buffer) {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6);
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    expect(flags & 0x08, "The package must include sizes in each local ZIP header").toBe(0);
    expect(compression, "The package must use the expected stored ZIP format").toBe(0);
    const filenameStart = offset + 30;
    const dataStart = filenameStart + filenameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    expect(dataEnd, "A ZIP entry must not exceed the downloaded package").toBeLessThanOrEqual(
      buffer.length,
    );
    const filename = buffer
      .subarray(filenameStart, filenameStart + filenameLength)
      .toString("utf8");
    files.set(filename, buffer.subarray(dataStart, dataEnd));
    offset = dataEnd;
  }
  return files;
}

async function reachPersonReview(dialog: Locator) {
  for (let step = 1; step < 6; step += 1) {
    await expect(dialog.getByText(`Etapa ${step} de 6`)).toBeVisible();
    await dialog.getByRole("button", { name: /^Próximo/ }).click();
  }
  await expect(dialog.getByText("Etapa 6 de 6")).toBeVisible();
}

test("persists a synthetic NEXO person with private sources through the transactional RPCs", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "admin", status_autorizacao: "autorizado" });
  const marker = Date.now().toString(36);
  const originalName = `Pessoa NEXO sintética ${marker}`;
  const editedName = `${originalName} revisada`;
  const resourceName = `recurso-nexo-${marker}.pdf`;
  const resourceObservation = `Recurso inteiramente sintético ${marker}`;
  const editedResourceObservation = `${resourceObservation} revisado`;
  const backendFailures: string[] = [];
  const photoUploads: Response[] = [];
  const pdfUploads: Response[] = [];
  const pdfMetadataWrites: Response[] = [];
  const resourceUploads: Response[] = [];
  const resourceMetadataWrites: Response[] = [];
  const resourceMetadataUpdates: Response[] = [];
  const signedPhotoReads: Response[] = [];
  const signedResourceReads: Response[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!response.ok() && /^(?:\/rest|\/storage|\/functions)\/v1\//.test(url.pathname)) {
      backendFailures.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
    if (
      response.request().method() === "POST" &&
      url.pathname.startsWith("/storage/v1/object/nexo-private/pessoas/") &&
      url.pathname.endsWith(".png")
    ) {
      photoUploads.push(response);
    }
    if (
      response.request().method() === "POST" &&
      url.pathname.startsWith("/storage/v1/object/nexo-private/pessoas/") &&
      url.pathname.includes("/documentos/") &&
      url.pathname.endsWith(".pdf")
    ) {
      pdfUploads.push(response);
    }
    if (
      response.request().method() === "POST" &&
      url.pathname === "/rest/v1/nexo_documentos_fontes"
    ) {
      pdfMetadataWrites.push(response);
    }
    if (
      response.request().method() === "GET" &&
      url.pathname.startsWith("/storage/v1/object/sign/nexo-private/pessoas/") &&
      !url.pathname.includes("/recursos/")
    ) {
      signedPhotoReads.push(response);
    }
    if (
      response.request().method() === "POST" &&
      url.pathname.startsWith("/storage/v1/object/nexo-private/pessoas/") &&
      url.pathname.includes("/recursos/") &&
      url.pathname.endsWith(".pdf")
    ) {
      resourceUploads.push(response);
    }
    if (
      response.request().method() === "POST" &&
      url.pathname === "/rest/v1/nexo_pessoa_recursos"
    ) {
      resourceMetadataWrites.push(response);
    }
    if (
      response.request().method() === "PATCH" &&
      url.pathname === "/rest/v1/nexo_pessoa_recursos"
    ) {
      resourceMetadataUpdates.push(response);
    }
    if (
      response.request().method() === "GET" &&
      url.pathname.startsWith("/storage/v1/object/sign/nexo-private/pessoas/") &&
      url.pathname.includes("/recursos/")
    ) {
      signedResourceReads.push(response);
    }
  });

  await submitLogin(page, user.login, user.password);
  await page.goto("/nexo");
  await expect(page.getByRole("button", { name: "Cadastrar pessoa" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Cadastrar pessoa" }).first().click();

  const createDialog = page.getByRole("dialog", { name: "Cadastrar pessoa" });
  await expect(createDialog).toBeVisible();
  await createDialog.getByRole("button", { name: /Anexo PDF/ }).click();
  await createDialog.locator('input[type="file"][accept=".pdf,application/pdf"]').setInputFiles({
    name: `fonte-nexo-${marker}.pdf`,
    mimeType: "application/pdf",
    buffer: onePagePdf(),
  });
  await expect(
    createDialog.getByRole("heading", { name: `fonte-nexo-${marker}.pdf` }),
  ).toBeVisible();
  await expect(createDialog.getByText(/1 página\(s\)/)).toBeVisible();
  await createDialog.getByRole("button", { name: "Revisar no cadastro (1 PDF)" }).click();
  await createDialog
    .locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles({
      name: "pessoa-nexo-sintetica.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await createDialog.getByLabel("Nome completo").fill(originalName);
  await createDialog.getByLabel("Apelido").fill(`Sintético ${marker}`);
  await reachPersonReview(createDialog);

  const createResponsePromise = page.waitForResponse((response) =>
    isNexoRpc(response, "nexo_criar_pessoa_completa"),
  );
  await createDialog.getByRole("button", { name: "Salvar registro" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), await createResponse.text()).toBe(true);
  await expect(createDialog).toBeHidden();
  await expect(page.getByText("Pessoa cadastrada", { exact: true })).toBeVisible();
  await expect.poll(() => photoUploads.length).toBe(1);
  expect(photoUploads[0]?.ok(), "The private NEXO photo must be stored").toBe(true);
  await expect.poll(() => pdfUploads.length).toBe(1);
  expect(pdfUploads[0]?.ok(), "The original NEXO PDF must be stored privately").toBe(true);
  await expect.poll(() => pdfMetadataWrites.length).toBe(1);
  expect(pdfMetadataWrites[0]?.ok(), "The NEXO PDF metadata must be persisted").toBe(true);

  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  const personCard = page.getByRole("button", { name: `Abrir ficha de ${originalName}` });
  await expect(personCard).toBeVisible();
  const originalPhoto = personCard.getByRole("img", { name: `Fotografia de ${originalName}` });
  await expect(originalPhoto).toBeVisible();
  await expect(originalPhoto).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/sign\/nexo-private\/pessoas\//,
  );
  await expect.poll(() => signedPhotoReads.length).toBeGreaterThan(0);
  await personCard.click();

  const summary = page.getByRole("dialog", { name: `Resumo de ${originalName}` });
  await expect(summary).toBeVisible();
  await summary.getByRole("button", { name: "Mostrar Informações Sigilosas" }).click();

  const dossier = page.getByRole("dialog", { name: `Dossiê de ${originalName}` });
  await expect(dossier).toBeVisible();
  await expect(dossier.getByText(`fonte-nexo-${marker}.pdf`, { exact: true })).toBeVisible();
  await expect(dossier.getByText(/1 página\(s\)/)).toBeVisible();

  await dossier.getByRole("button", { name: "Recursos", exact: true }).click();
  await dossier.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({
    name: resourceName,
    mimeType: "application/pdf",
    buffer: onePagePdf(),
  });
  await dossier.getByLabel("Observação do recurso").fill(resourceObservation);
  await dossier.getByRole("button", { name: "Anexar PDF" }).click();
  await expect(dossier.getByText(resourceName, { exact: true })).toBeVisible();
  const resourceCard = dossier.locator("article").filter({ hasText: resourceName });
  await expect(resourceCard).toContainText(resourceObservation);
  await expect(dossier.getByTitle(`Prévia de ${resourceName}`)).toBeVisible();
  await expect.poll(() => resourceUploads.length).toBe(1);
  expect(resourceUploads[0]?.ok(), "The NEXO resource PDF must be stored privately").toBe(true);
  await expect.poll(() => resourceMetadataWrites.length).toBe(1);
  expect(resourceMetadataWrites[0]?.ok(), "The NEXO resource metadata must be persisted").toBe(
    true,
  );
  await expect.poll(() => signedResourceReads.length).toBeGreaterThan(0);

  await resourceCard.getByRole("button", { name: `Editar observação de ${resourceName}` }).click();
  await resourceCard.getByLabel("Observação do recurso").fill(editedResourceObservation);
  await resourceCard.getByRole("button", { name: "Salvar" }).click();
  await expect(resourceCard).toContainText(editedResourceObservation);
  await expect.poll(() => resourceMetadataUpdates.length).toBe(1);
  expect(resourceMetadataUpdates[0]?.ok(), "The NEXO resource observation must be updated").toBe(
    true,
  );

  await dossier.getByRole("button", { name: "Editar cadastro" }).click();

  const editDialog = page.getByRole("dialog", { name: "Editar pessoa" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("Nome completo").fill(editedName);
  await reachPersonReview(editDialog);

  const updateResponsePromise = page.waitForResponse((response) =>
    isNexoRpc(response, "nexo_atualizar_pessoa_completa"),
  );
  await editDialog.getByRole("button", { name: "Salvar registro" }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok(), await updateResponse.text()).toBe(true);
  await expect(editDialog).toBeHidden();
  await expect(page.getByText("Cadastro da pessoa atualizado", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Pessoas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  const reloadedCard = page.getByRole("button", { name: `Abrir ficha de ${editedName}` });
  await expect(reloadedCard).toBeVisible();
  await expect(
    reloadedCard.getByRole("img", { name: `Fotografia de ${editedName}` }),
  ).toBeVisible();
  await reloadedCard.click();
  const reloadedSummary = page.getByRole("dialog", { name: `Resumo de ${editedName}` });
  await expect(reloadedSummary).toBeVisible();
  await reloadedSummary.getByRole("button", { name: "Mostrar Informações Sigilosas" }).click();
  const reloadedDossier = page.getByRole("dialog", { name: `Dossiê de ${editedName}` });
  await expect(reloadedDossier).toBeVisible();
  await expect(
    reloadedDossier.getByText(`fonte-nexo-${marker}.pdf`, { exact: true }),
  ).toBeVisible();
  await reloadedDossier.getByRole("button", { name: "Recursos", exact: true }).click();
  const reloadedResource = reloadedDossier.locator("article").filter({ hasText: resourceName });
  await expect(reloadedResource.getByText(resourceName, { exact: true })).toBeVisible();
  await expect(reloadedResource).toContainText(editedResourceObservation);
  await expect(reloadedResource.getByTitle(`Prévia de ${resourceName}`)).toBeVisible();

  await reloadedDossier.getByRole("button", { name: "Gerar relatório" }).click();
  const reportDialog = page.getByRole("dialog", { name: "Monte o relatório" });
  await expect(reportDialog).toBeVisible();
  await reportDialog.getByRole("button", { name: "Escolher fontes e PDFs" }).click();
  await expect(reportDialog.getByText(`fonte-nexo-${marker}.pdf`, { exact: true })).toBeVisible();
  await expect(reportDialog.getByText(resourceName, { exact: true })).toBeVisible();
  await reportDialog.getByRole("button", { name: "Voltar às seções" }).click();
  await reportDialog.getByRole("button", { name: "Prévia do documento" }).click();

  const reportPreview = page.locator('section[aria-label="Prévia do documento"]');
  await expect(reportPreview).toBeVisible();
  await expect(reportPreview.getByText("RELATÓRIO INDIVIDUAL DE INTELIGÊNCIA")).toBeVisible();
  await expect(reportPreview.getByText(editedName, { exact: true }).first()).toBeVisible();
  await expect(reportPreview.getByText(`fonte-nexo-${marker}.pdf`, { exact: true })).toBeVisible();
  const resourceSourceRow = reportPreview.getByRole("row").filter({ hasText: resourceName });
  await expect(resourceSourceRow).toBeVisible();
  await expect(resourceSourceRow).toContainText(editedResourceObservation);
  await expect(resourceSourceRow).toContainText("Recurso anexado");
  await reportPreview.getByRole("button", { name: "Fechar prévia do documento" }).click();

  const packageDownloadPromise = page.waitForEvent("download");
  await reportDialog.getByRole("button", { name: "Pacote documental" }).click();
  const packageDownload = await packageDownloadPromise;
  expect(await packageDownload.failure()).toBeNull();
  expect(packageDownload.suggestedFilename()).toMatch(
    /^nexo-pacote-documental-\d{4}-\d{2}-\d{2}\.zip$/,
  );
  const packagePath = await packageDownload.path();
  expect(packagePath).not.toBeNull();
  const packageEntries = readStoredZip(await readFile(packagePath!));
  expect(packageEntries.has("manifest.json")).toBe(true);
  expect(packageEntries.has("LEIA-ME.txt")).toBe(true);
  const packagedSource = [...packageEntries.entries()].find(([path]) =>
    path.endsWith(`/fonte-nexo-${marker}.pdf`),
  );
  const packagedResource = [...packageEntries.entries()].find(([path]) =>
    path.endsWith(`/${resourceName}`),
  );
  expect(packagedSource?.[1].subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(packagedResource?.[1].subarray(0, 5).toString("ascii")).toBe("%PDF-");
  const packageManifest = JSON.parse(packageEntries.get("manifest.json")!.toString("utf8")) as {
    format: string;
    people: Array<{ nome: string }>;
    entries: Array<{ path: string; status: string }>;
  };
  expect(packageManifest.format).toBe("nexo-document-package");
  expect(JSON.stringify(packageManifest)).not.toContain("/storage/v1/object/sign/");
  expect(JSON.stringify(packageManifest)).not.toContain("token=");
  expect(packageManifest.people).toContainEqual({ id: expect.any(String), nome: editedName });
  expect(packageManifest.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: packagedSource?.[0], status: "disponivel" }),
      expect.objectContaining({ path: packagedResource?.[0], status: "disponivel" }),
    ]),
  );
  await expect(reportDialog).toContainText("Pacote gerado com 3 arquivo(s).");

  await page.evaluate(() => {
    const browserWindow = window as Window & { __e2ePrintCount?: number };
    browserWindow.__e2ePrintCount = 0;
    browserWindow.print = () => {
      browserWindow.__e2ePrintCount = (browserWindow.__e2ePrintCount ?? 0) + 1;
    };
  });
  await reportDialog.getByRole("button", { name: "Gerar relatório" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __e2ePrintCount?: number }).__e2ePrintCount ?? 0),
    )
    .toBe(1);
  expect(backendFailures).toEqual([]);
});

test("redirects an authorized member without NEXO permission back to the module selector", async ({
  page,
}) => {
  const user = syntheticUser({ cargo: "membro", status_autorizacao: "autorizado" });
  await submitLogin(page, user.login, user.password);

  await page.goto("/nexo");
  await expect(page).toHaveURL(/\/modulos$/);
  await expect(page.getByRole("heading", { name: /Módulos do Sistema/i })).toBeVisible();
});
