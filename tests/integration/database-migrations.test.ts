import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const admin = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const suspendedAdmin = "00000000-0000-4000-8000-000000000003";
const judge = "00000000-0000-4000-8000-000000000004";
const atlas = "00000000-0000-4000-8000-000000000005";
const vehicle = "10000000-0000-4000-8000-000000000001";
const policeReport = "20000000-0000-4000-8000-000000000001";
const migrations = "supabase/migrations";
const sqlFile = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("isolated PostgreSQL migration integration", () => {
  const db = new PGlite();

  async function asUser<T>(
    userId: string,
    action: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      return action(tx);
    });
  }

  beforeAll(async () => {
    await db.exec(sqlFile("tests/integration/fixtures/database-bootstrap.sql"));
    for (const file of [
      "20261013145847_vehicle_inspections.sql",
      "20261013145923_vehicle_inspection_form_fields.sql",
      "20261013173322_vehicle_inspection_transactional_writes.sql",
      "20261019180222_link_vehicle_inspections_to_bo.sql",
    ]) {
      await db.exec(sqlFile(`${migrations}/${file}`));
    }
    // Reproduce the legacy default grants before applying the proposed hardening.
    await db.exec("grant all on all tables in schema public to anon, authenticated, service_role");
    for (const file of [
      "20261024111500_restore_required_storage_buckets.sql",
      "20261024123000_harden_privileged_rpcs.sql",
      "20261025022835_harden_data_api_table_grants.sql",
    ]) {
      await db.exec(sqlFile(`${migrations}/${file}`));
    }
  });

  afterAll(async () => db.close());

  it("denies the profile-directory RPC to a member with no institutional function", async () => {
    await expect(
      asUser(member, (tx) => tx.query("select * from public.list_profiles_for_admin()")),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it.each([admin, judge])(
    "allows an authorized admin or judge to list profiles (%s)",
    async (id) => {
      const result = await asUser(id, (tx) =>
        tx.query("select id from public.list_profiles_for_admin()"),
      );
      expect(result.rows).toHaveLength(5);
    },
  );

  it("requires a session and restricts the audit directory to privileged roles", async () => {
    await expect(
      asUser("", (tx) => tx.query("select * from public.list_profiles_for_admin()")),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(member, (tx) => tx.query("select * from public.list_auditoria()")),
    ).rejects.toMatchObject({ code: "42501" });
    const result = await asUser(admin, (tx) => tx.query("select * from public.list_auditoria()"));
    expect(result.rows).toEqual([]);
  });

  it("keeps hardened RPC search paths empty and anonymous execution revoked", async () => {
    const result = await db.query<{
      name: string;
      config: string[];
      anon: boolean;
      authenticated: boolean;
    }>(`
      select p.proname as name, p.proconfig as config,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'admin_update_user_access','list_profiles_for_admin','list_auditoria',
        'list_auditoria_by_user','list_auditoria_for_admin_user')
    `);
    expect(result.rows).toHaveLength(5);
    for (const row of result.rows) {
      expect(row.config).toEqual(['search_path=""']);
      expect(row).toMatchObject({ anon: false, authenticated: true });
    }
  });

  it.each([
    "select * from public.list_profiles_for_admin()",
    "select * from public.list_auditoria()",
    `select * from public.list_auditoria_by_user('${member}'::uuid)`,
    `select * from public.list_auditoria_for_admin_user('${member}'::uuid)`,
    `select public.admin_update_user_access('${member}'::uuid, 'membro', 'autorizado')`,
  ])("denies a suspended administrator: %s", async (query) => {
    await expect(asUser(suspendedAdmin, (tx) => tx.query(query))).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("preserves creation, revision and PDF attachment through transactional RPCs", async () => {
    await asUser(admin, async (tx) => {
      const created = await tx.query<{ id: string }>(
        "select id from public.create_vehicle_inspection($1::uuid, '2026-10-25'::date)",
        [vehicle],
      );
      const inspectionId = created.rows[0].id;
      await tx.query(
        "select id from public.update_vehicle_inspection($1::uuid, '2026-10-25', 'Synthetic location', null, '{}'::jsonb, 'Synthetic revision')",
        [inspectionId],
      );
      await tx.query(
        "select id from public.attach_vehicle_inspection_pdf($1::uuid, 2, 'synthetic/document.pdf', $2)",
        [inspectionId, "a".repeat(64)],
      );
      const result = await tx.query<{
        current_version: number;
        status: string;
        pdf_storage_path: string;
      }>(
        "select current_version, status, pdf_storage_path from public.vehicle_inspections where id=$1",
        [inspectionId],
      );
      expect(result.rows[0]).toEqual({
        current_version: 2,
        status: "emitido",
        pdf_storage_path: "synthetic/document.pdf",
      });
      const versions = await tx.query(
        "select version from public.vehicle_inspection_versions where inspection_id=$1 order by version",
        [inspectionId],
      );
      expect(versions.rows).toEqual([{ version: 1 }, { version: 2 }]);
    });
  });

  it("preserves authorized atlas access to B.O.-linked inspection RPCs", async () => {
    const created = await asUser(atlas, (tx) =>
      tx.query<{ id: string; bo_id: string; police_report_number: string }>(
        `select id, bo_id, police_report_number
         from public.create_vehicle_inspection(
           $1::uuid, '2026-10-26'::date, null, null, '{}'::jsonb,
           null, null, null, null, null, false, '{}'::jsonb, '[]'::jsonb,
           '{}'::jsonb, $2::uuid
         )`,
        [vehicle, policeReport],
      ),
    );
    expect(created.rows[0]).toMatchObject({
      bo_id: policeReport,
      police_report_number: "BO-SYNTHETIC-1",
    });

    const revised = await asUser(atlas, (tx) =>
      tx.query<{ current_version: number; bo_id: string }>(
        `select current_version, bo_id
         from public.update_vehicle_inspection(
           $1::uuid, '2026-10-27'::date, 'Synthetic atlas location', null,
           '{}'::jsonb, 'Synthetic atlas revision', null, null, null, null,
           null, false, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, $2::uuid
         )`,
        [created.rows[0].id, policeReport],
      ),
    );
    expect(revised.rows[0]).toMatchObject({ current_version: 2, bo_id: policeReport });
  });

  it("keeps inspection history immutable while preserving the PDF attachment workflow", async () => {
    const functionSecurity = await db.query<{
      name: string;
      definer: boolean;
      config: string[];
      anon_execute: boolean;
      authenticated_execute: boolean;
      direct_current_insert: boolean;
      direct_current_update: boolean;
      direct_history_insert: boolean;
      direct_history_update: boolean;
    }>(`
      select p.proname as name, p.prosecdef as definer, p.proconfig as config,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
        has_table_privilege(
          'authenticated',
          'public.vehicle_inspections',
          'INSERT'
        ) as direct_current_insert,
        has_table_privilege(
          'authenticated',
          'public.vehicle_inspections',
          'UPDATE'
        ) as direct_current_update,
        has_table_privilege(
          'authenticated',
          'public.vehicle_inspection_versions',
          'INSERT'
        ) as direct_history_insert,
        has_table_privilege(
          'authenticated',
          'public.vehicle_inspection_versions',
          'UPDATE'
        ) as direct_history_update
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (
          (p.proname = 'attach_vehicle_inspection_pdf'
            and pg_get_function_identity_arguments(p.oid) = 'p_inspection_id uuid, p_version integer, p_storage_path text, p_pdf_sha256 text')
          or (p.proname = 'create_vehicle_inspection'
            and pg_get_function_identity_arguments(p.oid) = 'p_vehicle_id uuid, p_inspection_date date, p_location text, p_inspector_notes text, p_findings jsonb, p_police_report_number text, p_presentation_reason text, p_presenting_institution text, p_yard_type text, p_yard_location text, p_delivery_restricted boolean, p_checklist jsonb, p_linked_people jsonb, p_original_vehicle_data jsonb, p_bo_id uuid')
          or (p.proname = 'update_vehicle_inspection'
            and pg_get_function_identity_arguments(p.oid) = 'p_inspection_id uuid, p_inspection_date date, p_location text, p_inspector_notes text, p_findings jsonb, p_change_reason text, p_police_report_number text, p_presentation_reason text, p_presenting_institution text, p_yard_type text, p_yard_location text, p_delivery_restricted boolean, p_checklist jsonb, p_linked_people jsonb, p_original_vehicle_data jsonb, p_bo_id uuid')
        )
      order by p.proname
    `);
    expect(functionSecurity.rows).toHaveLength(3);
    expect(functionSecurity.rows.map(({ name }) => name)).toEqual([
      "attach_vehicle_inspection_pdf",
      "create_vehicle_inspection",
      "update_vehicle_inspection",
    ]);
    for (const row of functionSecurity.rows) {
      expect(row).toMatchObject({
        definer: true,
        config: ['search_path=""'],
        anon_execute: false,
        authenticated_execute: true,
        direct_current_insert: false,
        direct_current_update: false,
        direct_history_insert: false,
        direct_history_update: false,
      });
    }

    const created = await asUser(admin, (tx) =>
      tx.query<{ id: string }>(
        "select id from public.create_vehicle_inspection($1::uuid, '2026-10-26'::date)",
        [vehicle],
      ),
    );
    const inspectionId = created.rows[0].id;

    await expect(
      asUser(member, (tx) =>
        tx.query(
          `insert into public.vehicle_inspection_versions
             (inspection_id, version, snapshot, change_reason, created_by)
           values ($1, 99, '{"forged":true}'::jsonb, 'forged', auth.uid())`,
          [inspectionId],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });

    await expect(
      asUser(member, (tx) =>
        tx.query(
          `update public.vehicle_inspections
           set current_version = 99,
               status = 'emitido',
               pdf_storage_path = 'synthetic/forged.pdf',
               pdf_sha256 = $2
           where id = $1`,
          [inspectionId, "d".repeat(64)],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });

    await expect(
      asUser(member, (tx) =>
        tx.query(
          "update public.vehicle_inspection_versions set snapshot = '{\"tampered\":true}'::jsonb where inspection_id = $1",
          [inspectionId],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });

    await expect(
      asUser(suspendedAdmin, (tx) =>
        tx.query(
          "select id from public.attach_vehicle_inspection_pdf($1::uuid, 1, 'synthetic/blocked.pdf', $2)",
          [inspectionId, "c".repeat(64)],
        ),
      ),
    ).rejects.toMatchObject({ message: "ACCESS_DENIED" });

    await asUser(member, (tx) =>
      tx.query(
        "select id from public.attach_vehicle_inspection_pdf($1::uuid, 1, 'synthetic/member-document.pdf', $2)",
        [inspectionId, "b".repeat(64)],
      ),
    );

    await expect(
      asUser(member, (tx) =>
        tx.query(
          "update public.vehicle_inspection_versions set pdf_storage_path = 'synthetic/replaced.pdf' where inspection_id = $1",
          [inspectionId],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });

    const versions = await asUser(member, (tx) =>
      tx.query<{ snapshot: Record<string, unknown>; pdf_storage_path: string }>(
        "select snapshot, pdf_storage_path from public.vehicle_inspection_versions where inspection_id = $1",
        [inspectionId],
      ),
    );
    expect(versions.rows).toEqual([
      {
        snapshot: expect.not.objectContaining({ tampered: true }),
        pdf_storage_path: "synthetic/member-document.pdf",
      },
    ]);
  });

  it("denies inspection writes and hides inspection rows from a suspended user", async () => {
    await asUser(suspendedAdmin, async (tx) => {
      const result = await tx.query("select id from public.vehicle_inspections");
      expect(result.rows).toEqual([]);
    });
    await expect(
      asUser(suspendedAdmin, (tx) =>
        tx.query("select id from public.create_vehicle_inspection($1::uuid, '2026-10-25'::date)", [
          vehicle,
        ]),
      ),
    ).rejects.toThrow("ACCESS_DENIED");
  });

  it("removes anonymous and structural browser-role privileges without changing service_role", async () => {
    const result = await db.query<{
      name: string;
      anon: boolean;
      truncate: boolean;
      trigger: boolean;
      references: boolean;
      service: boolean;
    }>(`
      select name,
        has_table_privilege('anon', name, 'SELECT,INSERT,UPDATE,DELETE') as anon,
        has_table_privilege('authenticated', name, 'TRUNCATE') as truncate,
        has_table_privilege('authenticated', name, 'TRIGGER') as trigger,
        has_table_privilege('authenticated', name, 'REFERENCES') as references,
        has_table_privilege('service_role', name, 'SELECT,INSERT,UPDATE,DELETE') as service
      from unnest(array['public.nexo_pessoas','public.nexo_organizacoes','public.nexo_vinculos',
        'public.nexo_documentos_fontes','public.nexo_documento_alegacoes',
        'public.vehicle_inspections','public.vehicle_inspection_versions']) as name
    `);
    expect(result.rows).toHaveLength(7);
    for (const row of result.rows) {
      expect(row).toMatchObject({
        anon: false,
        truncate: false,
        trigger: false,
        references: false,
        service: true,
      });
    }
  });

  it("restores only required private buckets and is idempotent", async () => {
    await db.exec(sqlFile(`${migrations}/20261024111500_restore_required_storage_buckets.sql`));
    const result = await db.query<{
      id: string;
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>("select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id");
    expect(result.rows.map((row) => row.id)).toEqual([
      "object-photos",
      "vehicle-inspection-pdfs",
      "vehicle-photos",
    ]);
    for (const row of result.rows) {
      expect(row.public).toBe(false);
      expect(Number(row.file_size_limit)).toBe(
        row.id.endsWith("pdfs") ? 15 * 1024 * 1024 : 8 * 1024 * 1024,
      );
      expect(row.allowed_mime_types).toEqual(
        row.id.endsWith("pdfs") ? ["application/pdf"] : ["image/jpeg", "image/png", "image/webp"],
      );
    }
    const objects = await db.query("select id, bucket_id from storage.objects");
    expect(objects.rows).toEqual([
      { id: "20000000-0000-4000-8000-000000000001", bucket_id: "vehicle-photos" },
    ]);
  });
});
