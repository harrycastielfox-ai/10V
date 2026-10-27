import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  getCurrentProfile,
  getProfileAvatarPublicUrl,
  updateOwnAvatar,
  updateOwnName,
  updateOwnPhone,
} from "@/lib/auth";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — SIED" },
      { name: "description", content: "Dados do usuário autenticado no SIED." },
    ],
  }),
  loader: async () => {
    let profile = null;
    try {
      profile = await getCurrentProfile();
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code !== "PROFILE_NOT_FOUND") {
        throw error;
      }
    }
    return { profile };
  },
  component: PerfilPage,
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_PHONE_DIGITS = 11;

function PerfilPage() {
  const { profile: loadedProfile } = Route.useLoaderData();
  const [profile, setProfile] = useState(loadedProfile);
  const profileMissing = !profile;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [avatarPath, setAvatarPath] = useState(profile?.avatar_path ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [nameDraft, setNameDraft] = useState(profile?.nome ?? "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [phoneDigits, setPhoneDigits] = useState(getPhoneDigits(profile?.telefone ?? ""));
  const [phoneDraft, setPhoneDraft] = useState(getPhoneDigits(profile?.telefone ?? ""));
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const freshProfile = await getCurrentProfile();
        if (cancelled || !freshProfile) return;
        const freshPhone = getPhoneDigits(freshProfile.telefone ?? "");
        setProfile(freshProfile);
        setAvatarPath(freshProfile.avatar_path ?? null);
        setNameDraft(freshProfile.nome ?? "");
        setPhoneDigits(freshPhone);
        setPhoneDraft(freshPhone);
      } catch (error) {
        console.warn("[perfil] Não foi possível revalidar perfil atualizado", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const avatarUrl = useMemo(() => {
    if (previewUrl) return previewUrl;
    return getProfileAvatarPublicUrl(avatarPath);
  }, [avatarPath, previewUrl]);

  const initial = (profile?.nome?.trim().charAt(0) || "?").toUpperCase();

  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleString("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "Não informado";

  const openFilePicker = () => {
    if (isSavingAvatar) return;
    fileInputRef.current?.click();
  };

  const resetPendingAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  const onFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFeedback(null);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
      setFeedback({ type: "error", message: "Selecione uma imagem JPG, PNG ou WebP." });
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setFeedback({ type: "error", message: "A imagem deve ter no máximo 2MB." });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const cancelAvatarChange = () => {
    setFeedback(null);
    resetPendingAvatar();
  };

  const startNameEdit = () => {
    if (isSavingName) return;
    setNameDraft(profile?.nome ?? "");
    setNameFeedback(null);
    setIsEditingName(true);
  };

  const cancelNameEdit = () => {
    if (isSavingName) return;
    setNameDraft(profile?.nome ?? "");
    setNameFeedback(null);
    setIsEditingName(false);
  };

  const saveName = async () => {
    if (isSavingName) return;
    const requestedName = nameDraft.trim().replace(/\s+/g, " ");

    if (requestedName.length < 2) {
      setNameFeedback({ type: "error", message: "Informe um nome com pelo menos 2 caracteres." });
      return;
    }

    if (requestedName.length > 120) {
      setNameFeedback({ type: "error", message: "O nome deve ter no máximo 120 caracteres." });
      return;
    }

    setIsSavingName(true);
    setNameFeedback(null);

    try {
      await updateOwnName(requestedName);
      const freshProfile = await getCurrentProfile();

      if (freshProfile) {
        setProfile(freshProfile);
        setAvatarPath(freshProfile.avatar_path ?? null);
        setNameDraft(freshProfile.nome ?? requestedName);
      }

      setIsEditingName(false);
      setNameFeedback({ type: "success", message: "Nome atualizado com sucesso." });
    } catch (error) {
      console.error("[perfil] Erro ao atualizar nome", {
        userId: profile?.id ?? "unknown",
        error,
      });
      setNameFeedback({
        type: "error",
        message: "Não foi possível salvar o nome agora. Tente novamente em instantes.",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const startPhoneEdit = () => {
    if (isSavingPhone) return;
    setPhoneDraft(phoneDigits);
    setPhoneFeedback(null);
    setIsEditingPhone(true);
  };

  const cancelPhoneEdit = () => {
    if (isSavingPhone) return;
    setPhoneDraft(phoneDigits);
    setPhoneFeedback(null);
    setIsEditingPhone(false);
  };

  const savePhone = async () => {
    if (isSavingPhone) return;
    setIsSavingPhone(true);
    setPhoneFeedback(null);

    try {
      const requestedPhone = getPhoneDigits(phoneDraft);
      await updateOwnPhone(requestedPhone);
      const freshProfile = await getCurrentProfile();
      const savedPhone = getPhoneDigits(freshProfile?.telefone ?? "");

      if (requestedPhone !== savedPhone) {
        throw new Error("PHONE_NOT_PERSISTED");
      }

      if (freshProfile) {
        setProfile(freshProfile);
        setAvatarPath(freshProfile.avatar_path ?? null);
      }
      setPhoneDigits(savedPhone);
      setPhoneDraft(savedPhone);
      setIsEditingPhone(false);
      setPhoneFeedback({ type: "success", message: "Telefone atualizado com sucesso." });
    } catch (error) {
      console.error("[perfil] Erro ao atualizar telefone", {
        userId: profile?.id ?? "unknown",
        error,
      });
      setPhoneFeedback({
        type: "error",
        message: "Não foi possível salvar o telefone agora. Tente novamente em instantes.",
      });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const saveAvatar = async () => {
    if (!selectedFile || isSavingAvatar) return;
    setIsSavingAvatar(true);
    setFeedback(null);

    try {
      if (!profile) throw new Error("PROFILE_NOT_FOUND");
      const newAvatarPath = await updateOwnAvatar(profile.id, selectedFile);
      setAvatarPath(newAvatarPath);
      window.dispatchEvent(
        new CustomEvent("profile-avatar-updated", { detail: { avatarPath: newAvatarPath } }),
      );
      resetPendingAvatar();
      setFeedback({ type: "success", message: "Foto de perfil atualizada com sucesso." });
    } catch (error) {
      console.error("[perfil] Erro ao atualizar foto de perfil", {
        userId: profile?.id ?? "unknown",
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        error,
      });
      setFeedback({
        type: "error",
        message: "Não foi possível salvar a foto agora. Tente novamente em instantes.",
      });
    } finally {
      setIsSavingAvatar(false);
    }
  };

  if (profileMissing) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-primary/25 bg-card/70 p-6">
          <h1 className="text-xl font-bold tracking-wide text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Não localizamos o perfil da sessão atual. Sua conta pode ter sido criada recentemente.
          </p>
          <p className="text-sm text-muted-foreground">
            Tente sair e entrar novamente. Se o problema continuar, contate um administrador.
          </p>
          <div>
            <Link to="/" className="text-sm font-medium text-primary underline">
              Voltar ao painel
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <div className="rounded-xl border border-primary/30 bg-card/80 p-5">
          <h1 className="text-xl font-bold tracking-wide text-foreground">Meu Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados institucionais da sua conta no SIED.
          </p>
        </div>

        <div className="rounded-xl border border-primary/25 bg-card/70 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={openFilePicker}
              className="group relative h-20 w-20 overflow-hidden rounded-full border border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Alterar foto de perfil"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`Avatar de ${profile.nome}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/15 text-2xl font-bold text-primary">
                  {initial}
                </div>
              )}
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-[11px] font-medium text-white/0 transition group-hover:bg-black/30 group-hover:text-white/95 group-focus-visible:bg-black/30 group-focus-visible:text-white/95">
                Alterar foto
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onFileSelected}
              aria-label="Selecionar nova foto de perfil"
            />

            <div className="min-w-0 space-y-2">
              {isEditingName ? (
                <div className="max-w-md space-y-2">
                  <label className="sr-only" htmlFor="profile-name">
                    Nome
                  </label>
                  <input
                    id="profile-name"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    maxLength={120}
                    className="w-full rounded-lg border border-primary/30 bg-background/70 px-3 py-2 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                    placeholder="Seu nome"
                    disabled={isSavingName}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={saveName}
                      className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSavingName}
                    >
                      {isSavingName ? "Salvando..." : "Salvar nome"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelNameEdit}
                      className="rounded-md border border-primary/25 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSavingName}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-foreground">{profile.nome}</p>
                  <button
                    type="button"
                    onClick={startNameEdit}
                    className="rounded-full border border-primary/25 px-2.5 py-1 text-[11px] font-semibold text-primary/85 transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                  >
                    Editar nome
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <button
                type="button"
                onClick={openFilePicker}
                className="text-xs font-medium text-primary/80 transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingAvatar}
              >
                Alterar foto de perfil
              </button>

              {selectedFile ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={saveAvatar}
                    className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingAvatar}
                  >
                    {isSavingAvatar ? "Salvando..." : "Salvar foto"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelAvatarChange}
                    className="rounded-md border border-primary/25 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingAvatar}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              {feedback ? (
                <p
                  className={`text-xs ${feedback.type === "success" ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {feedback.message}
                </p>
              ) : null}

              {nameFeedback ? (
                <p
                  className={`text-xs ${nameFeedback.type === "success" ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {nameFeedback.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Login" value={profile.login} />
          <PhoneInfoCard
            value={formatPhone(phoneDigits) || "Não informado"}
            draftValue={formatPhone(phoneDraft)}
            editing={isEditingPhone}
            saving={isSavingPhone}
            feedback={phoneFeedback}
            onEdit={startPhoneEdit}
            onCancel={cancelPhoneEdit}
            onSave={savePhone}
            onChange={(value) => setPhoneDraft(getPhoneDigits(value))}
          />
          <InfoCard label="Cargo" value={profile.cargo} />
          <InfoCard label="Status de autorização" value={profile.status_autorizacao} />
          <InfoCard label="Data de criação" value={createdAt} />
        </div>
      </div>
    </AppLayout>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-card/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  );
}

function PhoneInfoCard({
  value,
  draftValue,
  editing,
  saving,
  feedback,
  onEdit,
  onCancel,
  onSave,
  onChange,
}: {
  value: string;
  draftValue: string;
  editing: boolean;
  saving: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Telefone institucional
          </p>
          {!editing ? (
            <p className="mt-2 text-sm font-medium text-foreground break-words">{value}</p>
          ) : null}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-md border border-primary/25 px-3 py-1 text-xs font-medium text-primary/80 transition hover:border-primary/45 hover:text-primary"
          >
            Editar telefone
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <input
            value={draftValue}
            onChange={(event) => onChange(event.target.value)}
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(83) 99999-9999"
            className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/45 focus:ring-2 focus:ring-primary/10"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar telefone"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-md border border-primary/25 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p
          className={`mt-3 text-xs ${feedback.type === "success" ? "text-emerald-400" : "text-rose-400"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}

function getPhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, MAX_PHONE_DIGITS);
}

function formatPhone(value: string) {
  const digits = getPhoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
