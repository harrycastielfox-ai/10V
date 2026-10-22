import {
  Camera,
  Check,
  ContactRound,
  FileBadge,
  Link2,
  MapPin,
  Plus,
  ScanFace,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { NexoOrganizacao, NexoPessoaInput } from "../nexoTypes";

const PERSON_STEPS = [
  "Identificação",
  "Perfil civil",
  "Aparência",
  "Vínculo inicial",
  "Endereço atual",
  "Revisão",
];

const field =
  "h-11 w-full rounded-xl border border-[#d9e5ed] bg-white px-3 text-sm text-[#18384f] outline-none placeholder:text-[#567184] focus:border-[#33a0b4] disabled:cursor-not-allowed disabled:border-[#e1e8ed] disabled:bg-[#edf2f5] disabled:text-[#567184]";
const textarea =
  "min-h-24 w-full rounded-xl border border-[#d9e5ed] bg-white px-3 py-2 text-sm text-[#18384f] outline-none placeholder:text-[#567184] focus:border-[#33a0b4]";

function WizardField({
  label,
  children,
  wide = false,
  action,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  action?: ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[.11em] text-[#768b9d]">
        {label}
        {action}
      </span>
      {children}
    </label>
  );
}

export function NexoPersonWizard({
  step,
  person,
  setPerson,
  organizations,
  initialOrganizationId,
}: {
  step: number;
  person: NexoPessoaInput;
  setPerson: Dispatch<SetStateAction<NexoPessoaInput>>;
  organizations: NexoOrganizacao[];
  initialOrganizationId: string | null;
}) {
  const [photoPreview, setPhotoPreview] = useState("");
  const photoObjectUrlRef = useRef("");
  const extraDocuments = person.documentos_extras ?? [];
  const contacts = person.contatos ?? [];

  useEffect(() => {
    const previousUrl = photoObjectUrlRef.current;
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    if (!person.foto_perfil) {
      photoObjectUrlRef.current = "";
      setPhotoPreview("");
      return;
    }

    const nextUrl = URL.createObjectURL(person.foto_perfil);
    photoObjectUrlRef.current = nextUrl;
    setPhotoPreview(nextUrl);
    return () => {
      if (photoObjectUrlRef.current === nextUrl) {
        URL.revokeObjectURL(nextUrl);
        photoObjectUrlRef.current = "";
      }
    };
  }, [person.foto_perfil]);

  if (step === 0) {
    return (
      <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#4e94a8]">
            Fotografia principal
          </p>
          <div className="relative mt-3">
            <label className="flex min-h-[310px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed border-[#a8d2dc] bg-[#edf8fa] text-center transition hover:border-[#42aabc] hover:bg-[#e5f5f8]">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Prévia da pessoa"
                  className="h-[310px] w-full object-cover"
                />
              ) : (
                <span className="p-7">
                  <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-[#25879d] shadow-sm">
                    <Camera className="h-8 w-8" />
                  </span>
                  <strong className="mt-5 block text-sm text-[#1e455e]">
                    Adicionar fotografia
                  </strong>
                  <small className="mt-2 block text-xs leading-relaxed text-[#728b9a]">
                    A mesma imagem será utilizada no perfil e nos relatórios em PDF.
                  </small>
                  <span className="mt-4 inline-block rounded-full bg-[#173d5b] px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white">
                    Selecionar arquivo
                  </span>
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.currentTarget.value = "";
                  setPerson((current) => ({
                    ...current,
                    foto_perfil: file,
                    foto_relatorio: file,
                  }));
                }}
              />
            </label>
            {photoPreview ? (
              <button
                type="button"
                aria-label="Remover fotografia"
                title="Remover fotografia"
                onClick={() =>
                  setPerson((current) => ({
                    ...current,
                    foto_perfil: null,
                    foto_relatorio:
                      current.foto_relatorio === current.foto_perfil
                        ? null
                        : current.foto_relatorio,
                  }))
                }
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-base font-black text-[#1d425c]">Identificação da pessoa</h3>
          <p className="mt-1 text-xs text-[#567184]">
            Informe os dados conhecidos. Campos desconhecidos podem ser marcados como “Não consta”.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <WizardField label="Nome completo" wide>
              <input
                required
                autoFocus
                className={field}
                value={person.nome}
                onChange={(event) => setPerson({ ...person, nome: event.target.value })}
              />
            </WizardField>
            <WizardField label="Apelido">
              <input
                className={field}
                value={person.apelido}
                onChange={(event) => setPerson({ ...person, apelido: event.target.value })}
              />
            </WizardField>
            <WizardField label="Nome social">
              <input
                className={field}
                value={person.nome_social}
                onChange={(event) => setPerson({ ...person, nome_social: event.target.value })}
              />
            </WizardField>
            <WizardField label="CPF">
              <input
                className={field}
                value={person.cpf}
                onChange={(event) => setPerson({ ...person, cpf: event.target.value })}
              />
            </WizardField>
            <WizardField label="RG">
              <input
                className={field}
                value={person.rg}
                onChange={(event) => setPerson({ ...person, rg: event.target.value })}
              />
            </WizardField>
            <WizardField
              label={person.idade_aproximada ? "Idade estimada" : "Data de nascimento"}
              action={
                <button
                  type="button"
                  role="switch"
                  aria-checked={person.idade_aproximada}
                  onClick={() =>
                    setPerson({
                      ...person,
                      idade_aproximada: !person.idade_aproximada,
                      data_nascimento: !person.idade_aproximada ? "" : person.data_nascimento,
                      idade_aproximada_valor: person.idade_aproximada
                        ? null
                        : person.idade_aproximada_valor,
                    })
                  }
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 normal-case tracking-normal transition ${
                    person.idade_aproximada
                      ? "bg-[#dff3f6] text-[#197e93]"
                      : "bg-[#eef3f6] text-[#6d8291]"
                  }`}
                >
                  <span
                    className={`h-3.5 w-3.5 rounded border ${
                      person.idade_aproximada
                        ? "border-[#168da4] bg-[#168da4] shadow-[inset_0_0_0_3px_white]"
                        : "border-[#9cabb5] bg-white"
                    }`}
                  />
                  Idade aproximada
                </button>
              }
            >
              {person.idade_aproximada ? (
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="130"
                    inputMode="numeric"
                    className={`${field} pr-16`}
                    value={person.idade_aproximada_valor ?? ""}
                    onChange={(event) =>
                      setPerson({
                        ...person,
                        idade_aproximada_valor: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    placeholder="Informe a idade estimada"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#567184]">
                    anos
                  </span>
                </div>
              ) : (
                <input
                  type="date"
                  className={field}
                  value={person.data_nascimento}
                  onChange={(event) =>
                    setPerson({ ...person, data_nascimento: event.target.value })
                  }
                />
              )}
            </WizardField>
            <WizardField label="Onde nasceu">
              <input
                className={field}
                value={person.naturalidade}
                onChange={(event) => setPerson({ ...person, naturalidade: event.target.value })}
                placeholder="Cidade/UF"
              />
            </WizardField>
            <WizardField
              label="Nome da mãe"
              action={
                <button
                  type="button"
                  role="switch"
                  aria-checked={person.nome_mae === "NÃO CONSTA"}
                  onClick={() =>
                    setPerson({
                      ...person,
                      nome_mae: person.nome_mae === "NÃO CONSTA" ? "" : "NÃO CONSTA",
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 normal-case tracking-normal transition ${
                    person.nome_mae === "NÃO CONSTA"
                      ? "bg-[#dff3f6] text-[#197e93]"
                      : "bg-[#eef3f6] text-[#6d8291]"
                  }`}
                >
                  <span
                    className={`h-3.5 w-3.5 rounded border ${
                      person.nome_mae === "NÃO CONSTA"
                        ? "border-[#168da4] bg-[#168da4] shadow-[inset_0_0_0_3px_white]"
                        : "border-[#9cabb5] bg-white"
                    }`}
                  />
                  Não consta
                </button>
              }
            >
              <input
                className={field}
                value={person.nome_mae === "NÃO CONSTA" ? "" : person.nome_mae}
                disabled={person.nome_mae === "NÃO CONSTA"}
                onChange={(event) => setPerson({ ...person, nome_mae: event.target.value })}
                placeholder={person.nome_mae === "NÃO CONSTA" ? "Informação não consta" : ""}
              />
            </WizardField>
            <WizardField
              label="Nome do pai"
              action={
                <button
                  type="button"
                  role="switch"
                  aria-checked={person.nome_pai === "NÃO CONSTA"}
                  onClick={() =>
                    setPerson({
                      ...person,
                      nome_pai: person.nome_pai === "NÃO CONSTA" ? "" : "NÃO CONSTA",
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 normal-case tracking-normal transition ${
                    person.nome_pai === "NÃO CONSTA"
                      ? "bg-[#dff3f6] text-[#197e93]"
                      : "bg-[#eef3f6] text-[#6d8291]"
                  }`}
                >
                  <span
                    className={`h-3.5 w-3.5 rounded border ${
                      person.nome_pai === "NÃO CONSTA"
                        ? "border-[#168da4] bg-[#168da4] shadow-[inset_0_0_0_3px_white]"
                        : "border-[#9cabb5] bg-white"
                    }`}
                  />
                  Não consta
                </button>
              }
            >
              <input
                className={field}
                value={person.nome_pai === "NÃO CONSTA" ? "" : person.nome_pai}
                disabled={person.nome_pai === "NÃO CONSTA"}
                onChange={(event) => setPerson({ ...person, nome_pai: event.target.value })}
                placeholder={person.nome_pai === "NÃO CONSTA" ? "Informação não consta" : ""}
              />
            </WizardField>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <div className="flex items-start gap-4 rounded-2xl border border-[#cee4ea] bg-[#edf8fa] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#27879c]">
            <ContactRound className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-black text-[#1d425c]">Perfil civil e contatos</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6f8797]">
              Dados complementares, documentos e meios de contato. Use “sem informação” quando o
              dado não puder ser confirmado.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <WizardField label="Sexo">
            <select
              className={field}
              value={person.sexo}
              onChange={(event) => setPerson({ ...person, sexo: event.target.value })}
            >
              <option value="">Sem informação</option>
              <option>Feminino</option>
              <option>Masculino</option>
              <option>Intersexo</option>
              <option>Não identificado</option>
            </select>
          </WizardField>
          <WizardField label="Raça / cor">
            <select
              className={field}
              value={person.raca_cor}
              onChange={(event) => setPerson({ ...person, raca_cor: event.target.value })}
            >
              <option value="">Sem informação</option>
              <option>Branca</option>
              <option>Negra</option>
              <option>Parda</option>
              <option>Amarela</option>
              <option>Indígena</option>
              <option>Outra</option>
            </select>
          </WizardField>
          <WizardField label="Estado civil">
            <select
              className={field}
              value={person.estado_civil}
              onChange={(event) => setPerson({ ...person, estado_civil: event.target.value })}
            >
              <option value="">Sem informação</option>
              <option>Solteiro(a)</option>
              <option>Casado(a)</option>
              <option>União estável</option>
              <option>Separado(a)</option>
              <option>Divorciado(a)</option>
              <option>Viúvo(a)</option>
            </select>
          </WizardField>
          <WizardField label="Nacionalidade">
            <input
              className={field}
              value={person.nacionalidade}
              onChange={(event) => setPerson({ ...person, nacionalidade: event.target.value })}
            />
          </WizardField>
          <WizardField label="Escolaridade">
            <select
              className={field}
              value={person.escolaridade}
              onChange={(event) => setPerson({ ...person, escolaridade: event.target.value })}
            >
              <option value="">Sem informação</option>
              <option>Não alfabetizado</option>
              <option>Fundamental</option>
              <option>Médio</option>
              <option>Superior</option>
              <option>Pós-graduação</option>
            </select>
          </WizardField>
          <WizardField label="Profissão">
            <input
              className={field}
              value={person.profissao}
              onChange={(event) => setPerson({ ...person, profissao: event.target.value })}
            />
          </WizardField>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <CompactCollection
            icon={FileBadge}
            title="Documentos adicionais"
            actionLabel="Adicionar documento"
            items={extraDocuments.map((item) => ({
              id: item.id,
              primary: item.tipo,
              secondary: item.numero,
            }))}
            onAdd={() =>
              setPerson({
                ...person,
                documentos_extras: [
                  ...extraDocuments,
                  { id: crypto.randomUUID(), tipo: "CNH", numero: "" },
                ],
              })
            }
            onRemove={(id) =>
              setPerson({
                ...person,
                documentos_extras: extraDocuments.filter((item) => item.id !== id),
              })
            }
            onUpdate={(id, primary, secondary) =>
              setPerson({
                ...person,
                documentos_extras: extraDocuments.map((item) =>
                  item.id === id ? { ...item, tipo: primary, numero: secondary } : item,
                ),
              })
            }
          />
          <CompactCollection
            icon={ContactRound}
            title="Contatos e redes sociais"
            actionLabel="Adicionar contato"
            items={contacts.map((item) => ({
              id: item.id,
              primary: item.tipo,
              secondary: item.valor,
              checked: item.whatsapp,
            }))}
            onAdd={() =>
              setPerson({
                ...person,
                contatos: [
                  ...contacts,
                  { id: crypto.randomUUID(), tipo: "Telefone celular", valor: "", whatsapp: false },
                ],
              })
            }
            onRemove={(id) =>
              setPerson({ ...person, contatos: contacts.filter((item) => item.id !== id) })
            }
            onUpdate={(id, primary, secondary, checked) =>
              setPerson({
                ...person,
                contatos: contacts.map((item) =>
                  item.id === id
                    ? { ...item, tipo: primary, valor: secondary, whatsapp: checked }
                    : item,
                ),
              })
            }
          />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mx-auto max-w-[960px]">
        <div className="flex items-start gap-4 rounded-2xl border border-[#cee4ea] bg-[#edf8fa] p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#27879c]">
            <ScanFace className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-black text-[#1d425c]">
              Aparência e identificação visual
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6f8797]">
              Registre características observáveis que auxiliem na identificação da pessoa.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <WizardField label="Altura aproximada (cm)">
            <input
              type="number"
              min="30"
              max="260"
              className={field}
              value={person.altura_cm ?? ""}
              onChange={(event) =>
                setPerson({
                  ...person,
                  altura_cm: event.target.value ? Number(event.target.value) : null,
                })
              }
              placeholder="Ex.: 180"
            />
          </WizardField>
          <WizardField label="Tipo físico">
            <select
              className={field}
              value={person.tipo_fisico}
              onChange={(event) => setPerson({ ...person, tipo_fisico: event.target.value })}
            >
              <option value="">Sem informação</option>
              <option>Magro</option>
              <option>Mediano</option>
              <option>Atlético</option>
              <option>Robusto</option>
              <option>Outro</option>
            </select>
          </WizardField>
          <WizardField label="Estado aparente">
            <input
              className={field}
              value={person.estado_aparente}
              onChange={(event) => setPerson({ ...person, estado_aparente: event.target.value })}
              placeholder="Ex.: saudável, lesionado, debilitado"
            />
          </WizardField>
          <WizardField label="Sinais particulares">
            <input
              className={field}
              value={person.sinais_particulares}
              onChange={(event) =>
                setPerson({ ...person, sinais_particulares: event.target.value })
              }
              placeholder="Tatuagens, cicatrizes, marcas e outras características"
            />
          </WizardField>
        </div>
        <div className="mt-5 max-w-md">
          <ToggleCard
            label="Utiliza tornozeleira eletrônica"
            checked={person.usa_tornozeleira}
            onChange={(checked) => setPerson({ ...person, usa_tornozeleira: checked })}
          />
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mx-auto max-w-[900px]">
        <div className="flex items-start gap-4 rounded-2xl border border-[#cee4ea] bg-[#edf8fa] p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#27879c]">
            <Link2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-black text-[#1d425c]">Vínculo inicial</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#6f8797]">
              O cadastro pode permanecer sem facção até que a informação seja corroborada.
            </p>
            {initialOrganizationId ? (
              <p className="mt-2 text-xs font-bold text-[#277a8b]">
                Cadastro iniciado a partir do dossiê de{" "}
                {organizations.find((item) => item.id === initialOrganizationId)?.nome || "facção"}.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <WizardField label="Facção">
            <select
              className={field}
              value={person.organizacao_id}
              onChange={(event) => setPerson({ ...person, organizacao_id: event.target.value })}
            >
              <option value="">Sem facção definida</option>
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </WizardField>
          <WizardField label="Situação do vínculo">
            <select
              className={field}
              value={person.vinculo_status}
              onChange={(event) =>
                setPerson({
                  ...person,
                  vinculo_status: event.target.value as NexoPessoaInput["vinculo_status"],
                })
              }
            >
              <option value="nao_confirmado">Não confirmado</option>
              <option value="suspeito">Suspeito</option>
              <option value="provavel">Provável</option>
              <option value="confirmado">Confirmado</option>
              <option value="desvinculado">Desvinculado</option>
            </select>
          </WizardField>
          <WizardField label="Função descrita">
            <input
              className={field}
              value={person.vinculo_funcao}
              onChange={(event) => setPerson({ ...person, vinculo_funcao: event.target.value })}
              placeholder="Ex.: liderança, apoio logístico"
            />
          </WizardField>
          <WizardField label="Confiança (0–100)">
            <input
              type="number"
              min="0"
              max="100"
              className={field}
              value={person.vinculo_confianca}
              onChange={(event) =>
                setPerson({ ...person, vinculo_confianca: Number(event.target.value) })
              }
            />
          </WizardField>
          <WizardField label="Resumo da fonte" wide>
            <textarea
              className={textarea}
              value={person.fonte_resumo}
              onChange={(event) => setPerson({ ...person, fonte_resumo: event.target.value })}
              placeholder="Informe a origem e o contexto da associação."
            />
          </WizardField>
        </div>
      </div>
    );
  }

  if (step === 4) {
    const selectedOrganization = organizations.find((item) => item.id === person.organizacao_id);
    return (
      <div className="mx-auto max-w-[960px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-[#1d425c]">Endereço atual e rota</h3>
            <p className="mt-1 text-xs text-[#567184]">
              Informe o endereço conhecido, utilize a referência da facção ou sinalize situação de
              rua.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={person.em_situacao_rua}
            onClick={() =>
              setPerson({
                ...person,
                em_situacao_rua: !person.em_situacao_rua,
                usar_local_faccao: false,
              })
            }
            className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-black transition ${
              person.em_situacao_rua
                ? "border-[#62b9c8] bg-[#eaf7f9] text-[#246b7d]"
                : "border-[#d7e5eb] bg-white text-[#61798b]"
            }`}
          >
            Em situação de rua
            <span
              className={`h-4 w-4 rounded border ${
                person.em_situacao_rua
                  ? "border-[#168da4] bg-[#168da4] shadow-[inset_0_0_0_3px_white]"
                  : "border-[#9cabb5] bg-white"
              }`}
            />
          </button>
        </div>

        {!person.em_situacao_rua ? (
          <div className="mt-5 flex justify-end">
            <div className="flex rounded-xl border border-[#d7e5eb] bg-white p-1">
              <button
                type="button"
                onClick={() => setPerson({ ...person, usar_local_faccao: false })}
                className={`rounded-lg px-3 py-2 text-[11px] font-black ${
                  !person.usar_local_faccao
                    ? "bg-[#173d5b] text-white"
                    : "text-[#668093] hover:bg-[#f2f7f9]"
                }`}
              >
                Informar endereço
              </button>
              <button
                type="button"
                onClick={() => setPerson({ ...person, usar_local_faccao: true })}
                className={`rounded-lg px-3 py-2 text-[11px] font-black ${
                  person.usar_local_faccao
                    ? "bg-[#173d5b] text-white"
                    : "text-[#668093] hover:bg-[#f2f7f9]"
                }`}
              >
                Usar local da facção / sem informação
              </button>
            </div>
          </div>
        ) : null}

        {person.em_situacao_rua ? (
          <div className="mt-8 flex min-h-[250px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#e3b9a9] bg-[#fff8f4] p-8 text-center">
            <MapPin className="h-10 w-10 text-[#c66c4a]" />
            <h4 className="mt-4 text-base font-black text-[#744530]">Pessoa em situação de rua</h4>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#8b6a5c]">
              Nenhum endereço residencial será vinculado. Pontos de permanência e referências
              poderão ser registrados posteriormente no dossiê individual.
            </p>
          </div>
        ) : person.usar_local_faccao ? (
          <div className="mt-8 flex min-h-[250px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#b9d5dd] bg-[#f0f8fa] p-8 text-center">
            <MapPin className="h-10 w-10 text-[#318da2]" />
            <h4 className="mt-4 text-base font-black text-[#24465d]">
              Referência territorial aplicada
            </h4>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#708798]">
              {selectedOrganization
                ? `Será utilizada a área informada para ${selectedOrganization.nome}: ${selectedOrganization.area_atuacao || "local ainda não detalhado"}.`
                : "Nenhuma facção foi selecionada. O endereço ficará registrado como não informado."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <WizardField label="Logradouro" wide>
              <input
                className={field}
                value={person.endereco.logradouro}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, logradouro: event.target.value },
                  })
                }
              />
            </WizardField>
            <WizardField label="Número">
              <input
                className={field}
                value={person.endereco.numero}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, numero: event.target.value },
                  })
                }
              />
            </WizardField>
            <WizardField label="Bairro">
              <input
                className={field}
                value={person.endereco.bairro}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, bairro: event.target.value },
                  })
                }
              />
            </WizardField>
            <WizardField label="Município">
              <input
                className={field}
                value={person.endereco.municipio}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, municipio: event.target.value },
                  })
                }
              />
            </WizardField>
            <WizardField label="Link de navegação" wide>
              <input
                type="url"
                className={field}
                value={person.endereco.link_navegacao}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, link_navegacao: event.target.value },
                  })
                }
                placeholder="Cole um link do Google Maps, Waze ou outro aplicativo"
              />
            </WizardField>
            <WizardField label="Ponto de referência">
              <input
                className={field}
                value={person.endereco.ponto_referencia}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, ponto_referencia: event.target.value },
                  })
                }
              />
            </WizardField>
            <WizardField label="Como chegar" wide>
              <textarea
                className={textarea}
                value={person.endereco.como_chegar}
                onChange={(event) =>
                  setPerson({
                    ...person,
                    endereco: { ...person.endereco, como_chegar: event.target.value },
                  })
                }
              />
            </WizardField>
          </div>
        )}
      </div>
    );
  }

  const selectedOrganization = organizations.find((item) => item.id === person.organizacao_id);
  return (
    <div className="mx-auto max-w-[960px]">
      <div className="grid gap-4 md:grid-cols-3">
        <ReviewCard icon={UserRound} label="Pessoa" value={person.nome || "Nome não informado"}>
          {person.apelido || "Sem apelido"} · {person.cpf || "CPF não informado"}
        </ReviewCard>
        <ReviewCard
          icon={Link2}
          label="Vínculo"
          value={selectedOrganization?.nome || "Sem facção definida"}
        >
          Confiança registrada em {person.vinculo_confianca}%
        </ReviewCard>
        <ReviewCard
          icon={MapPin}
          label="Localização"
          value={
            person.em_situacao_rua
              ? "Em situação de rua"
              : person.usar_local_faccao
                ? "Referência da facção"
                : person.endereco.bairro || "Não informada"
          }
        >
          {person.em_situacao_rua
            ? "Sem endereço residencial vinculado"
            : person.usar_local_faccao
              ? selectedOrganization?.area_atuacao || "Sem área detalhada"
              : `${person.endereco.municipio}/${person.endereco.uf}`}
        </ReviewCard>
      </div>
      <div className="mt-6 rounded-2xl border border-[#dbe7ed] bg-white p-5">
        <h3 className="text-sm font-black text-[#1d425c]">Observações finais</h3>
        <p className="mt-1 text-xs text-[#567184]">
          Registre informações adicionais, ressalvas ou orientações para análise.
        </p>
        <textarea
          className={`${textarea} mt-4 min-h-36`}
          value={person.observacoes}
          onChange={(event) => setPerson({ ...person, observacoes: event.target.value })}
          placeholder="Observações complementares sobre a pessoa…"
        />
      </div>
    </div>
  );
}

function ReviewCard({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#dbe7ed] bg-white p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf5f7] text-[#2b859a]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="mt-4 block text-[11px] font-black uppercase tracking-[.16em] text-[#567184]">
        {label}
      </span>
      <strong className="mt-1 block truncate text-sm text-[#23465e]">{value}</strong>
      <small className="mt-1 block text-[11px] leading-relaxed text-[#567184]">{children}</small>
    </div>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-xs font-bold transition ${checked ? "border-[#62b9c8] bg-[#eaf7f9] text-[#246b7d]" : "border-[#dbe6ec] bg-white text-[#61798b]"}`}
    >
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#168da4]"
      />
    </label>
  );
}

function CompactCollection({
  icon: Icon,
  title,
  actionLabel,
  items,
  onAdd,
  onRemove,
  onUpdate,
}: {
  icon: typeof FileBadge;
  title: string;
  actionLabel: string;
  items: Array<{ id: string; primary: string; secondary: string; checked?: boolean }>;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, primary: string, secondary: string, checked: boolean) => void;
}) {
  const contactMode = title.includes("Contatos");
  return (
    <section className="rounded-2xl border border-[#dbe7ed] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-xs font-black text-[#24475f]">
          <Icon className="h-4 w-4 text-[#29889e]" /> {title}
        </h4>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-[#173d5b] px-3 py-2 text-[11px] font-black text-white"
        >
          <Plus className="h-3.5 w-3.5" /> {actionLabel}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[150px_minmax(0,1fr)_auto] gap-2">
            <select
              value={item.primary}
              onChange={(event) =>
                onUpdate(item.id, event.target.value, item.secondary, Boolean(item.checked))
              }
              className="h-9 rounded-lg border border-[#d9e5ed] bg-[#f8fafb] px-2 text-[11px] text-[#405e73]"
            >
              {(contactMode
                ? [
                    "Telefone celular",
                    "Telefone recado",
                    "WhatsApp",
                    "Instagram",
                    "Facebook",
                    "E-mail",
                    "Outro",
                  ]
                : [
                    "CPF",
                    "RG - Carteira de identidade",
                    "CNH",
                    "Passaporte",
                    "Título de eleitor",
                    "Certidão de nascimento",
                    "Certidão de casamento",
                    "CTPS - Carteira de trabalho",
                    "PIS / PASEP",
                    "Certificado de reservista",
                    "RNE - Registro Nacional de Estrangeiro",
                    "CRNM - Carteira de Registro Nacional Migratório",
                    "Cartão do SUS",
                    "Cartão de plano de saúde",
                    "Cartão de banco",
                    "Crachá funcional",
                    "CRLV",
                    "DUT - Documento Único de Transferência",
                    "Porte de arma",
                    "Registro de arma de fogo",
                    "Outro",
                  ]
              ).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <input
              value={item.secondary}
              onChange={(event) =>
                onUpdate(item.id, item.primary, event.target.value, Boolean(item.checked))
              }
              placeholder={contactMode ? "Número, perfil ou endereço" : "Número / identificação"}
              className="h-9 min-w-0 rounded-lg border border-[#d9e5ed] px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="Remover"
              className="rounded-lg border border-red-100 bg-red-50 p-2 text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!items.length ? (
          <p className="py-2 text-center text-[11px] text-[#567184]">Nenhum item adicional.</p>
        ) : null}
      </div>
    </section>
  );
}

export function PersonWizardProgress({ step }: { step: number }) {
  return (
    <div className="nexo-wizard-progress mx-5 mt-5 px-5 py-4 sm:mx-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <strong className="text-[#244f66]">{PERSON_STEPS[step]}</strong>
        <span className="text-[#567184]">
          Etapa {step + 1} de {PERSON_STEPS.length}
        </span>
      </div>
      <ol
        aria-label="Etapas do cadastro de pessoa"
        className="mx-auto flex max-w-[1120px] items-center"
      >
        {PERSON_STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center last:flex-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  index < step
                    ? "bg-[#2e9caf] text-white"
                    : index === step
                      ? "bg-[#173d5b] text-white ring-4 ring-[#dcecf1]"
                      : "bg-[#eaf0f4] text-[#567184]"
                }`}
              >
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={`hidden truncate text-[11px] font-semibold lg:block ${index === step ? "text-[#1c526d]" : "text-[#567184]"}`}
              >
                {label}
              </span>
            </span>
            {index < PERSON_STEPS.length - 1 ? (
              <span
                className={`mx-3 h-px flex-1 ${index < step ? "bg-[#54b7c7]" : "bg-[#dce6eb]"}`}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
