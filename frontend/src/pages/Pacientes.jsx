import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  garantirSessaoValida,
  obterToken,
  removerToken,
} from "../utils/auth.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const cpfMask = (v = "") =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const phoneMask = (v = "") => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  return n.length > 10
    ? n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    : n.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
};

const cepMask = (v = "") =>
  v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");

function obterIniciais(nome = "") {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "PC";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

async function executarRequisicao(path, options, bearerToken) {
  const response = await axios.request({
    baseURL: API,
    url: `/api/v1/pacientes${path}`,
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      ...options.headers,
    },
  });
  return response.data;
}

async function api(path, options = {}) {
  let tokenAtual = obterToken() || (await garantirSessaoValida());
  try {
    return await executarRequisicao(path, options, tokenAtual);
  } catch (error) {
    if (error.response?.status === 401) {
      removerToken();
      const novoToken = await garantirSessaoValida();
      if (novoToken) {
        try {
          return await executarRequisicao(path, options, novoToken);
        } catch (retryError) {
          const msg =
            retryError.response?.data?.detail ||
            retryError.message ||
            "Falha na comunicação com o servidor.";
          const err = new Error(msg);
          err.status = retryError.response?.status;
          throw err;
        }
      }
    }
    const msg =
      error.response?.data?.detail ||
      error.message ||
      "Falha na comunicação com o servidor.";
    const err = new Error(msg);
    err.status = error.response?.status;
    throw err;
  }
}

const empty = {
  nome_completo: "",
  cpf: "",
  data_nascimento: "",
  sexo: "NAO_INFORMAR",
  telefone_principal: "",
  telefone_secundario: "",
  email: "",
  user_account_id: "",
  endereco: {
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  },
};

function AlertaProfissional({
  tipo = "error",
  mensagem,
  onClose,
  onReconectar,
  onIrLogin,
}) {
  if (!mensagem) return null;

  const ehSessao =
    /token|sessão|expirad|autentic|credencial|autorizad/i.test(mensagem);

  const titulo =
    tipo === "success"
      ? "Operação concluída"
      : ehSessao
        ? "Sessão expirada ou credencial inválida"
        : "Não foi possível concluir a solicitação";

  return (
    <div
      role={tipo === "success" ? "status" : "alert"}
      className={`clinical-alert ${
        tipo === "success"
          ? "clinical-alert-success"
          : ehSessao
            ? "clinical-alert-warning"
            : "clinical-alert-error"
      }`}
    >
      <div className="clinical-alert-icon" aria-hidden="true">
        {tipo === "success" ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <div className="clinical-alert-body">
        <strong>{titulo}</strong>
        <p>
          {ehSessao && tipo !== "success"
            ? "Sua sessão anterior expirou ao alternar de perfil ou ficar inativa. Você pode reconectar agora ou acessar a tela de login."
            : mensagem}
        </p>
      </div>

      <div className="clinical-alert-actions">
        {ehSessao && tipo !== "success" && onReconectar && (
          <button
            type="button"
            className="clinical-alert-btn clinical-alert-btn-primary"
            onClick={onReconectar}
          >
            ↻ Reconectar sessão
          </button>
        )}
        {ehSessao && tipo !== "success" && onIrLogin && (
          <button
            type="button"
            className="clinical-alert-btn"
            onClick={onIrLogin}
          >
            Fazer login
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="clinical-alert-close"
            aria-label="Fechar aviso"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export function Pacientes() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ busca: "", ativo: "true" });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [mostrarVinculoConta, setMostrarVinculoConta] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const queryClient = useQueryClient();
  const qs = new URLSearchParams({
    page,
    limit: 20,
    ...(filters.busca ? { busca: filters.busca } : {}),
    ...(filters.ativo ? { ativo: filters.ativo } : {}),
  });

  const {
    data = { items: [], total: 0, page, limit: 20 },
    error: queryError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["pacientes", filters, page],
    queryFn: () => api(`?${qs}`),
    retry: 1,
  });

  useEffect(() => {
    setPage(1);
  }, [filters]);

  async function handleReconectar() {
    setError("");
    removerToken();
    await garantirSessaoValida();
    await refetch();
  }

  function startEdit(patient) {
    setEditing(patient.id);
    setError("");
    setSuccessMsg("");
    setMostrarVinculoConta(Boolean(patient.user_account_id));
    setForm({
      ...patient,
      cpf: cpfMask(patient.cpf),
      data_nascimento: patient.data_nascimento,
      endereco: patient.endereco || empty.endereco,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicao() {
    setEditing(null);
    setForm(empty);
    setMostrarVinculoConta(false);
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const payload = {
        ...form,
        cpf: form.cpf.replace(/\D/g, ""),
        user_account_id: form.user_account_id?.trim() || null,
        endereco: Object.values(form.endereco || {}).some(Boolean)
          ? Object.fromEntries(
              Object.entries(form.endereco).map(([key, value]) => [
                key,
                value || null,
              ])
            )
          : null,
        telefone_secundario: form.telefone_secundario || null,
        email: form.email || null,
      };
      await api(editing ? `/${editing}` : "", {
        method: editing ? "PUT" : "POST",
        data: payload,
      });
      setSuccessMsg(
        editing
          ? "Dados cadastrais do paciente atualizados com sucesso."
          : "Paciente cadastrado com sucesso."
      );
      setForm(empty);
      setEditing(null);
      setMostrarVinculoConta(false);
      await queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id) {
    if (!window.confirm("Deseja realmente inativar este cadastro?")) return;
    setError("");
    setSuccessMsg("");
    try {
      await api(`/${id}/inativar`, { method: "PATCH" });
      setSuccessMsg("Cadastro do paciente inativado.");
      await queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    } catch (e) {
      setError(e.message);
    }
  }

  const mensagemErroAtiva = error || queryError?.message || "";

  return (
    <main className="patient-admin page-stack">
      {mensagemErroAtiva && (
        <AlertaProfissional
          tipo="error"
          mensagem={mensagemErroAtiva}
          onClose={() => setError("")}
          onReconectar={handleReconectar}
          onIrLogin={() => navigate("/")}
        />
      )}

      {successMsg && (
        <AlertaProfissional
          tipo="success"
          mensagem={successMsg}
          onClose={() => setSuccessMsg("")}
        />
      )}

      <section className="card patient-form-card">
        <header className="patient-card-top">
          <div className="patient-card-top-left">
            <span className="patient-card-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </span>
            <div>
              <h2 className="card-title">
                {editing ? "Editar cadastro do paciente" : "Novo paciente"}
              </h2>
            </div>
          </div>

          {editing && (
            <span className="patient-editing-badge">Modo edição</span>
          )}
        </header>

        <form className="patient-structured-form" onSubmit={save}>
          <div className="patient-form-section">
            <div className="patient-form-section-title">
              <span className="patient-section-num">1</span>
              <strong>Dados pessoais</strong>
            </div>

            <div className="patient-grid patient-grid-personal">
              <label className="patient-field patient-span-2">
                <span>
                  Nome completo <abbr title="Obrigatório">*</abbr>
                </span>
                <input
                  required
                  minLength="2"
                  placeholder="Ex.: Maria Aparecida dos Santos"
                  value={form.nome_completo}
                  onChange={(e) =>
                    setForm({ ...form, nome_completo: e.target.value })
                  }
                />
              </label>

              <label className="patient-field">
                <span>
                  CPF <abbr title="Obrigatório">*</abbr>
                </span>
                <input
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) =>
                    setForm({ ...form, cpf: cpfMask(e.target.value) })
                  }
                />
              </label>

              <label className="patient-field">
                <span>
                  Data de nascimento <abbr title="Obrigatório">*</abbr>
                </span>
                <input
                  required
                  type="date"
                  value={form.data_nascimento}
                  onChange={(e) =>
                    setForm({ ...form, data_nascimento: e.target.value })
                  }
                />
              </label>

              <label className="patient-field">
                <span>Sexo</span>
                <select
                  value={form.sexo}
                  onChange={(e) => setForm({ ...form, sexo: e.target.value })}
                >
                  <option value="NAO_INFORMAR">Prefiro não informar</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
            </div>
          </div>

          <div className="patient-form-section">
            <div className="patient-form-section-title">
              <span className="patient-section-num">2</span>
              <strong>Contato</strong>
            </div>

            <div className="patient-grid patient-grid-contact">
              <label className="patient-field">
                <span>
                  Telefone principal <abbr title="Obrigatório">*</abbr>
                </span>
                <input
                  required
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  value={form.telefone_principal}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefone_principal: phoneMask(e.target.value),
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>Telefone secundário</span>
                <input
                  inputMode="tel"
                  placeholder="(00) 0000-0000 (opcional)"
                  value={form.telefone_secundario || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefone_secundario: phoneMask(e.target.value),
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>E-mail</span>
                <input
                  type="email"
                  placeholder="paciente@email.com"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="patient-form-section">
            <div className="patient-form-section-title">
              <span className="patient-section-num">3</span>
              <strong>Endereço residencial</strong>
            </div>

            <div className="patient-grid patient-grid-address">
              <label className="patient-field">
                <span>CEP</span>
                <input
                  inputMode="numeric"
                  maxLength="9"
                  placeholder="00000-000"
                  value={form.endereco?.cep || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endereco: {
                        ...form.endereco,
                        cep: cepMask(e.target.value),
                      },
                    })
                  }
                />
              </label>

              <label className="patient-field patient-span-2">
                <span>Logradouro</span>
                <input
                  placeholder="Rua, avenida, travessa..."
                  value={form.endereco?.logradouro || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endereco: {
                        ...form.endereco,
                        logradouro: e.target.value,
                      },
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>Número</span>
                <input
                  placeholder="Ex.: 120"
                  value={form.endereco?.numero || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endereco: { ...form.endereco, numero: e.target.value },
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>Bairro</span>
                <input
                  placeholder="Ex.: Centro"
                  value={form.endereco?.bairro || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endereco: { ...form.endereco, bairro: e.target.value },
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>Cidade</span>
                <input
                  placeholder="Ex.: Cajazeiras"
                  value={form.endereco?.cidade || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endereco: { ...form.endereco, cidade: e.target.value },
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>UF</span>
                <select
                  value={form.endereco?.uf || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endereco: { ...form.endereco, uf: e.target.value },
                    })
                  }
                >
                  <option value="">Selecione</option>
                  {UFS.map((sigla) => (
                    <option key={sigla} value={sigla}>
                      {sigla}
                    </option>
                  ))}
                </select>
              </label>

              <div className="patient-account-link-wrap">
                <button
                  type="button"
                  className="patient-link-toggle"
                  onClick={() => setMostrarVinculoConta((v) => !v)}
                >
                  {mostrarVinculoConta
                    ? "− Ocultar vínculo de conta de acesso"
                    : "+ Vincular conta de usuário existente (opcional)"}
                </button>

                {mostrarVinculoConta && (
                  <label className="patient-field patient-account-field">
                    <span>ID da conta do usuário (UUID)</span>
                    <input
                      placeholder="Ex.: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
                      value={form.user_account_id || ""}
                      onChange={(e) =>
                        setForm({ ...form, user_account_id: e.target.value })
                      }
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="patient-form-footer">
            <span className="patient-required-hint">
              Campos marcados com <strong>*</strong> são obrigatórios
            </span>

            <div className="patient-form-buttons">
              {editing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelarEdicao}
                >
                  Cancelar edição
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setForm(empty)}
                >
                  Limpar campos
                </button>
              )}

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy
                  ? "Salvando..."
                  : editing
                    ? "Salvar alterações"
                    : "+ Cadastrar paciente"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="patient-list-header">
          <div className="records-directory-title-group">
            <h2 className="card-title">Pacientes cadastrados</h2>
            <span className="records-count-badge">
              {data.total} registro(s)
            </span>
          </div>

          <div className="patient-filters-bar">
            <label className="search-field patient-search-box">
              <span className="search-symbol" aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                aria-label="Buscar por nome ou CPF"
                placeholder="Buscar por nome ou CPF..."
                value={filters.busca}
                onChange={(e) =>
                  setFilters({ ...filters, busca: e.target.value })
                }
              />
            </label>

            <select
              className="form-input patient-status-select"
              aria-label="Filtrar situação"
              value={filters.ativo}
              onChange={(e) =>
                setFilters({ ...filters, ativo: e.target.value })
              }
            >
              <option value="true">Apenas ativos</option>
              <option value="false">Apenas inativos</option>
              <option value="">Todos os status</option>
            </select>
          </div>
        </div>

        <div className="patient-table-wrap">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Situação</th>
                <th className="patient-col-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="patient-table-name-cell">
                      <span className="patient-mini-avatar" aria-hidden="true">
                        {obterIniciais(p.nome_completo)}
                      </span>
                      <div>
                        <strong>{p.nome_completo}</strong>
                        {p.email && <small>{p.email}</small>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="patient-mono-pill">{cpfMask(p.cpf)}</span>
                  </td>
                  <td>{p.telefone_principal}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        p.ativo ? "status-confirmed" : "status-completed"
                      }`}
                    >
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="patient-col-actions">
                    <div className="patient-row-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => startEdit(p)}
                      >
                        Editar
                      </button>
                      {p.ativo && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => deactivate(p.id)}
                        >
                          Inativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!data.items.length && (
                <tr>
                  <td colSpan="5" className="patient-empty-cell">
                    {isFetching
                      ? "Carregando pacientes..."
                      : "Nenhum paciente encontrado para os filtros selecionados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="patient-pagination">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ← Anterior
          </button>
          <span className="patient-page-indicator">Página {page}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={page * data.limit >= data.total}
            onClick={() => setPage(page + 1)}
          >
            Próxima →
          </button>
        </div>
      </section>
    </main>
  );
}

export function PatientProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/me")
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api(`/${profile.id}`, {
        method: "PUT",
        data: {
          telefone_principal: profile.telefone_principal,
          telefone_secundario: profile.telefone_secundario || null,
          email: profile.email || null,
        },
      });
      setMessage("Seus dados de contato foram atualizados com sucesso.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">MEU CADASTRO</span>
          <h1 className="page-title">Meu perfil</h1>
          <p className="page-subtitle">
            Mantenha seus telefones e e-mail de contato atualizados.
          </p>
        </div>
      </header>

      {error && (
        <AlertaProfissional
          tipo="error"
          mensagem={error}
          onClose={() => setError("")}
          onIrLogin={() => navigate("/")}
        />
      )}

      {message && (
        <AlertaProfissional
          tipo="success"
          mensagem={message}
          onClose={() => setMessage("")}
        />
      )}

      {profile && (
        <section className="card">
          <div className="patient-profile-head">
            <span className="patient-mini-avatar" aria-hidden="true">
              {obterIniciais(profile.nome_completo)}
            </span>
            <div>
              <h2 className="card-title">{profile.nome_completo}</h2>
              <p className="card-description">
                CPF: {cpfMask(profile.cpf)} · Nascimento:{" "}
                {profile.data_nascimento}
              </p>
            </div>
          </div>

          <form className="patient-structured-form" onSubmit={save}>
            <div className="patient-grid patient-grid-contact">
              <label className="patient-field">
                <span>Telefone principal</span>
                <input
                  required
                  value={profile.telefone_principal}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      telefone_principal: phoneMask(e.target.value),
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>Telefone secundário</span>
                <input
                  value={profile.telefone_secundario || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      telefone_secundario: phoneMask(e.target.value),
                    })
                  }
                />
              </label>

              <label className="patient-field">
                <span>E-mail</span>
                <input
                  type="email"
                  value={profile.email || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="patient-form-footer">
              <span />
              <button type="submit" className="btn btn-primary">
                Atualizar contatos
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
