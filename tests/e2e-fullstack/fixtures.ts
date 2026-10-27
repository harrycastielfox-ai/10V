import { expect, test as base, type BrowserContext } from "@playwright/test";

export interface SyntheticUser {
  email: string;
  login: string;
  password: string;
  cargo: string;
  status_autorizacao: string;
}

const users = JSON.parse(process.env.E2E_SYNTHETIC_USERS_JSON ?? "[]") as SyntheticUser[];

export function syntheticUser(
  criteria: Partial<Pick<SyntheticUser, "cargo" | "status_autorizacao">>,
) {
  const user = users.find((candidate) =>
    Object.entries(criteria).every(
      ([name, value]) => candidate[name as keyof SyntheticUser] === value,
    ),
  );
  if (!user) throw new Error(`Missing synthetic user for ${JSON.stringify(criteria)}`);
  return user;
}

async function installBackendIsolation(context: BrowserContext) {
  const blockedOrigins: string[] = [];
  const disallowedBackendApi = new RegExp(
    "^https?://(?!127\\.0\\.0\\.1:\\d+/)[^/]+/(?:auth|rest|storage|functions)/v1(?:/|$)",
    "i",
  );
  await context.route(disallowedBackendApi, async (route) => {
    blockedOrigins.push(new URL(route.request().url()).origin);
    await route.abort("blockedbyclient");
  });
  return blockedOrigins;
}

export const test = base.extend<{ backendIsolation: void }>({
  backendIsolation: [
    async ({ context }, use) => {
      const blockedOrigins = await installBackendIsolation(context);
      await use();
      expect(blockedOrigins, "Full-stack tests attempted an API outside the local gateway").toEqual(
        [],
      );
    },
    { auto: true },
  ],
});

export { expect };
