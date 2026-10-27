import assert from "node:assert/strict";

// Deliberately small behavioral checks against the COMPLETE recovered schema,
// with the original functions/policies and synthetic identities only. These do
// not claim full RLS coverage, Supabase default-grant parity or service parity.
export async function verifyRecoveredRuntime(db, probes) {
  const admin = "00000000-0000-4000-8000-000000000101";
  const member = "00000000-0000-4000-8000-000000000102";
  const blocked = "00000000-0000-4000-8000-000000000103";
  const person = "10000000-0000-4000-8000-000000000101";
  async function probe(name, action) {
    const entry = { name, passed: false };
    probes.push(entry);
    await action();
    entry.passed = true;
  }
  async function asUser(id, action) {
    return db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
      return action(tx);
    });
  }
  await probe(
    "confirmed platform grants keep profile writes and schema creation denied",
    async () => {
      const result = await db.query(
        "select has_schema_privilege('authenticated','public','USAGE') as usage, has_schema_privilege('authenticated','public','CREATE') as create, has_table_privilege('authenticated','public.profiles','SELECT') as select, has_table_privilege('authenticated','public.profiles','INSERT') as insert, has_table_privilege('authenticated','public.profiles','UPDATE') as update, has_table_privilege('authenticated','public.profiles','DELETE') as delete",
      );
      assert.deepEqual(result.rows, [
        { usage: true, create: false, select: true, insert: false, update: false, delete: false },
      ]);
    },
  );
  await probe("seed only synthetic auth/profile identities", async () => {
    for (const [id, name, role, status] of [
      [admin, "Replay admin", "admin", "autorizado"],
      [member, "Replay member", "membro", "autorizado"],
      [blocked, "Replay blocked admin", "admin", "bloqueado"],
    ]) {
      await db.query("insert into auth.users(id, email) values($1, $2)", [
        id,
        `${id}@example.invalid`,
      ]);
      const created = await db.query(
        "select id, status_autorizacao::text as status from public.profiles where id = $1",
        [id],
      );
      assert.deepEqual(created.rows, [{ id, status: "aguardando" }]);
      await db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [admin]);
        await tx.query(
          "update public.profiles set nome=$2,email=$3,login=$4,cargo=$5,status_autorizacao=$6 where id=$1",
          [id, name, `${id}@example.invalid`, id, role, status],
        );
      });
    }
  });
  await probe(
    "profile SELECT remains restricted to the caller by the real self policy",
    async () => {
      const result = await asUser(member, (tx) => tx.query("select id from public.profiles"));
      assert.deepEqual(result.rows, [{ id: member }]);
    },
  );
  await probe(
    "authenticated vehicle timeline retains executable access through the private schema",
    async () => {
      const privileges = await db.query(
        "select has_schema_privilege('authenticated','private','USAGE') as schema_usage, has_function_privilege('authenticated','private.list_vehicle_timeline(uuid,integer)','EXECUTE') as private_execute, has_function_privilege('authenticated','public.list_vehicle_timeline(uuid,integer)','EXECUTE') as public_execute",
      );
      assert.deepEqual(privileges.rows, [
        { schema_usage: true, private_execute: true, public_execute: true },
      ]);
      await assert.rejects(
        asUser(admin, (tx) =>
          tx.query(
            "select * from public.list_vehicle_timeline('30000000-0000-4000-8000-000000000101'::uuid, 100)",
          ),
        ),
        { code: "P0002" },
      );
    },
  );
  await probe(
    "authorized admin executes profile directory with the real final OUT contract",
    async () => {
      const result = await asUser(admin, (tx) =>
        tx.query("select * from public.list_profiles_for_admin()"),
      );
      assert.equal(result.rows.length, 3);
      assert.ok(result.fields.some((field) => field.name === "telefone"));
      assert.ok(result.fields.some((field) => field.name === "funcao_institucional"));
    },
  );
  await probe("member and blocked administrator are denied the privileged directory", async () => {
    for (const id of [member, blocked]) {
      await assert.rejects(
        asUser(id, (tx) => tx.query("select * from public.list_profiles_for_admin()")),
        { code: "42501" },
      );
    }
  });
  await probe("all three hardened audit RPCs execute with executor_avatar_path", async () => {
    for (const query of [
      "select * from public.list_auditoria()",
      `select * from public.list_auditoria_by_user('${member}'::uuid)`,
      `select * from public.list_auditoria_for_admin_user('${member}'::uuid)`,
    ]) {
      const result = await asUser(admin, (tx) => tx.query(query));
      assert.ok(result.fields.some((field) => field.name === "executor_avatar_path"));
    }
  });
  await probe("blocked administrator cannot execute any hardened audit directory", async () => {
    for (const query of [
      "select * from public.list_auditoria()",
      `select * from public.list_auditoria_by_user('${member}'::uuid)`,
      `select * from public.list_auditoria_for_admin_user('${member}'::uuid)`,
    ]) {
      await assert.rejects(
        asUser(blocked, (tx) => tx.query(query)),
        { code: "42501" },
      );
    }
  });
  await probe(
    "real NEXO table grants and RLS allow admin creation and deny other profiles",
    async () => {
      await asUser(admin, (tx) =>
        tx.query("insert into public.nexo_pessoas(id,nome) values($1,'Synthetic replay person')", [
          person,
        ]),
      );
      assert.equal(
        (await asUser(admin, (tx) => tx.query("select id from public.nexo_pessoas"))).rows.length,
        1,
      );
      for (const id of [member, blocked]) {
        assert.equal(
          (await asUser(id, (tx) => tx.query("select id from public.nexo_pessoas"))).rows.length,
          0,
        );
        await assert.rejects(
          asUser(id, (tx) =>
            tx.query("insert into public.nexo_pessoas(nome) values('Synthetic rejected person')"),
          ),
          { code: "42501" },
        );
      }
    },
  );
  await probe(
    "frontend NEXO creation RPC is idempotent and denies unauthorized profiles",
    async () => {
      const requestId = "20000000-0000-4000-8000-000000000101";
      const payload = JSON.stringify({
        request_id: requestId,
        pessoa: { nome: "Synthetic replay RPC person" },
      });
      const createPerson = (id) =>
        asUser(id, (tx) =>
          tx.query("select public.nexo_criar_pessoa_completa($1::jsonb) as id", [payload]),
        );
      const first = await createPerson(admin);
      const retry = await createPerson(admin);
      assert.ok(first.rows[0].id);
      assert.equal(retry.rows[0].id, first.rows[0].id);
      const count = await asUser(admin, (tx) =>
        tx.query(
          "select count(*)::integer as count from public.nexo_pessoas where creation_request_id=$1::uuid",
          [requestId],
        ),
      );
      assert.deepEqual(count.rows, [{ count: 1 }]);
      for (const id of [member, blocked]) {
        await assert.rejects(createPerson(id), { code: "42501" });
      }
    },
  );
  await probe(
    "vehicle normalization executes with accented uppercase and blank input",
    async () => {
      const result = await asUser(admin, (tx) =>
        tx.query(
          "select public.normalize_vehicle_search(' AÇÃO  VISÍVEL ') as normalized, public.normalize_vehicle_search(null) as empty",
        ),
      );
      assert.deepEqual(result.rows, [{ normalized: "acao visivel", empty: "" }]);
    },
  );
}
