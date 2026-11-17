import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Btn from "../../components/Btn.jsx";
import Card from "../../components/Card.jsx";
import { useToast } from "../../components/ToastProvider.jsx";
import {
  alterarStatusProfissional,
  associarEspecialidades,
  atualizarProfissional,
  criarProfissional,
  desassociarEspecialidades,
  listarEspecialidades,
  listarProfissionais,
  removerProfissional,
} from "../../services/profissionaisApi.js";

function iniciais(nome = "") {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function ProfissionaisAdmin() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [profissionais, setProfissionais] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de listagem
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // Formulário (cadastro / edição)
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [documentoRegistro, setDocumentoRegistro] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [especialidadesSelecionadas, setEspecialidadesSelecionadas] = useState(
    []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [profs, esps] = await Promise.all([
        listarProfissionais({
          nome: filtroNome.trim() || undefined,
          especialidade_id: filtroEspecialidade || undefined,
          ativo:
            filtroStatus === "todos" ? undefined : filtroStatus === "ativos",
        }),
        listarEspecialidades(),
      ]);
      setProfissionais(profs);
      setEspecialidades(esps);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filtroNome, filtroEspecialidade, filtroStatus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function toggleEspecialidade(id) {
    setEspecialidadesSelecionadas((atuais) =>
      atuais.includes(id)
        ? atuais.filter((item) => item !== id)
        : [...atuais, id]
    );
  }

  function iniciarEdicao(prof) {
    setEditando(prof);
    setNome(prof.nome);
    setDocumentoRegistro(prof.documento_registro);
    setAtivo(prof.ativo);
    setEspecialidadesSelecionadas(prof.especialidades.map((e) => e.id));
    setError("");
  }

  function limparFormulario() {
    setEditando(null);
    setNome("");
    setDocumentoRegistro("");
    setAtivo(true);
    setEspecialidadesSelecionadas([]);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!nome.trim() || !documentoRegistro.trim()) {
      setError("Preencha o nome e o documento de registro no conselho.");
      return;
    }

    setSubmitting(true);
    try {
      if (editando) {
        await atualizarProfissional(editando.id, {
          nome: nome.trim(),
          documento_registro: documentoRegistro.trim(),
          ativo,
        });

        // Sincroniza associação N:N usando os endpoints de associar/desassociar
        const idsAntigos = new Set(editando.especialidades.map((e) => e.id));
        const idsNovos = new Set(especialidadesSelecionadas);
        const adicionar = [...idsNovos].filter((id) => !idsAntigos.has(id));
        const remover = [...idsAntigos].filter((id) => !idsNovos.has(id));

        if (adicionar.length > 0) {
          await associarEspecialidades(editando.id, adicionar);
        }
        if (remover.length > 0) {
          await desassociarEspecialidades(editando.id, remover);
        }

        showToast("Profissional atualizado com sucesso.");
      } else {
        await criarProfissional({
          nome: nome.trim(),
          documento_registro: documentoRegistro.trim(),
          ativo,
          especialidade_ids: especialidadesSelecionadas,
        });
        showToast("Profissional cadastrado com sucesso.");
      }

      limparFormulario();
      await carregar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAlternarStatus(prof) {
    try {
      const atualizado = await alterarStatusProfissional(prof.id, !prof.ativo);
      setProfissionais((atuais) =>
        atuais.map((item) => (item.id === prof.id ? atualizado : item))
      );
      if (editando?.id === prof.id) {
        setAtivo(atualizado.ativo);
        setEditando(atualizado);
      }
      showToast(
        atualizado.ativo
          ? `${prof.nome} foi ativado(a).`
          : `${prof.nome} foi inativado(a).`
      );
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleRemover(prof) {
    try {
      await removerProfissional(prof.id);
      if (editando?.id === prof.id) {
        limparFormulario();
      }
      showToast(`Profissional "${prof.nome}" removido(a).`);
      await carregar();
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">PAINEL ADMINISTRATIVO · UC05</span>
          <h2 className="page-title">Gestão de Profissionais</h2>
          <p className="page-subtitle">
            Cadastre profissionais de saúde, associe múltiplas especialidades e
            controle quem está ativo para agendamentos.
          </p>
        </div>
      </section>

      <div className="admin-grid">
        <Card
          title={
            editando ? `Editando: ${editando.nome}` : "Novo profissional"
          }
          description="Selecione uma ou mais especialidades para vincular ao profissional."
        >
          <form className="admin-form" onSubmit={handleSubmit}>
            <div>
              <label className="form-label" htmlFor="prof-nome">
                Nome completo
              </label>
              <input
                id="prof-nome"
                type="text"
                className="form-input"
                placeholder="Ex.: Dra. Ana Beatriz Lima"
                maxLength={150}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="prof-doc">
                Documento de registro (CRM, CREFITO, CRFa, CRP...)
              </label>
              <input
                id="prof-doc"
                type="text"
                className="form-input"
                placeholder="Ex.: CRFa-12345"
                maxLength={50}
                value={documentoRegistro}
                onChange={(e) => setDocumentoRegistro(e.target.value)}
              />
            </div>

            <div>
              <span className="form-label">
                Especialidades ({especialidadesSelecionadas.length}{" "}
                selecionada(s))
              </span>

              {especialidades.length === 0 ? (
                <p className="field-help">
                  Nenhuma especialidade cadastrada ainda. Cadastre em{" "}
                  <strong>Especialidades</strong> antes de vincular.
                </p>
              ) : (
                <div
                  className="chip-selector"
                  role="group"
                  aria-label="Selecionar especialidades"
                >
                  {especialidades.map((esp) => {
                    const marcada = especialidadesSelecionadas.includes(esp.id);
                    return (
                      <button
                        key={esp.id}
                        type="button"
                        aria-pressed={marcada}
                        onClick={() => toggleEspecialidade(esp.id)}
                        className={`chip-option ${
                          marcada ? "chip-option-active" : ""
                        }`}
                      >
                        <span>{marcada ? "✓" : "+"}</span>
                        <span>{esp.nome}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              <span>
                <strong>Profissional ativo</strong>
                <small>
                  Profissionais inativos não aparecem na busca de horários
                  disponíveis.
                </small>
              </span>
            </label>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="admin-form-actions">
              <Btn type="submit" disabled={submitting}>
                {submitting
                  ? "Salvando..."
                  : editando
                    ? "Salvar alterações"
                    : "Cadastrar profissional"}
              </Btn>

              {editando && (
                <Btn variant="secondary" onClick={limparFormulario}>
                  Cancelar edição
                </Btn>
              )}
            </div>
          </form>
        </Card>

        <Card
          title="Profissionais cadastrados"
          description={`${profissionais.length} profissional(is) listado(s)`}
        >
          <div className="admin-filters">
            <label className="search-field">
              <span className="search-symbol" aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                aria-label="Buscar profissional por nome"
                placeholder="Buscar por nome..."
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
              />
            </label>

            <select
              className="form-input admin-select"
              aria-label="Filtrar por especialidade"
              value={filtroEspecialidade}
              onChange={(e) => setFiltroEspecialidade(e.target.value)}
            >
              <option value="">Todas as especialidades</option>
              {especialidades.map((esp) => (
                <option key={esp.id} value={esp.id}>
                  {esp.nome}
                </option>
              ))}
            </select>

            <select
              className="form-input admin-select"
              aria-label="Filtrar por status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos os status</option>
              <option value="ativos">Apenas ativos</option>
              <option value="inativos">Apenas inativos</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">
              <strong>Carregando profissionais...</strong>
            </div>
          ) : profissionais.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">✚</span>
              <strong>Nenhum profissional encontrado</strong>
              <p>
                Cadastre um profissional ao lado ou ajuste os filtros de busca.
              </p>
            </div>
          ) : (
            <div className="records-list">
              {profissionais.map((prof) => (
                <article className="record-list-row" key={prof.id}>
                  <div
                    className={`patient-avatar ${
                      prof.ativo ? "avatar-mint" : "avatar-peach"
                    }`}
                    aria-hidden="true"
                  >
                    {iniciais(prof.nome)}
                  </div>

                  <div className="record-list-patient">
                    <div className="admin-title-row">
                      <strong>{prof.nome}</strong>
                      <span
                        className={`status-pill ${
                          prof.ativo ? "status-confirmed" : "status-cancelled"
                        }`}
                      >
                        {prof.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <span>Registro: {prof.documento_registro}</span>

                    {prof.especialidades.length > 0 ? (
                      <div className="tag-list">
                        {prof.especialidades.map((esp) => (
                          <span key={esp.id} className="specialty-tag">
                            {esp.nome}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <small>Sem especialidades vinculadas</small>
                    )}
                  </div>

                  <div className="admin-row-actions">
                    <Btn
                      variant="secondary"
                      size="small"
                      onClick={() =>
                        navigate(
                          `/admin/agenda?profissional=${prof.id}`
                        )
                      }
                    >
                      Agenda
                    </Btn>

                    <Btn
                      variant="outline"
                      size="small"
                      onClick={() => iniciarEdicao(prof)}
                    >
                      Editar
                    </Btn>

                    <Btn
                      variant={prof.ativo ? "danger" : "primary"}
                      size="small"
                      onClick={() => handleAlternarStatus(prof)}
                    >
                      {prof.ativo ? "Inativar" : "Ativar"}
                    </Btn>

                    <Btn
                      variant="ghost"
                      size="small"
                      onClick={() => handleRemover(prof)}
                    >
                      Excluir
                    </Btn>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

