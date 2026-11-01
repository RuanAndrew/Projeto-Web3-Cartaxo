import { useCallback, useEffect, useMemo, useState } from "react";

import Btn from "../../components/Btn.jsx";
import Card from "../../components/Card.jsx";
import { useToast } from "../../components/ToastProvider.jsx";
import {
  atualizarEspecialidade,
  criarEspecialidade,
  listarEspecialidades,
  removerEspecialidade,
} from "../../services/profissionaisApi.js";

export default function EspecialidadesAdmin() {
  const { showToast } = useToast();

  const [especialidades, setEspecialidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [nome, setNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await listarEspecialidades();
      setEspecialidades(lista);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = query.trim().toLowerCase();
    if (!termo) return especialidades;
    return especialidades.filter((item) =>
      item.nome.toLowerCase().includes(termo)
    );
  }, [especialidades, query]);

  function iniciarEdicao(item) {
    setEditandoId(item.id);
    setNome(item.nome);
    setError("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNome("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const limpo = nome.trim();
    if (!limpo) {
      setError("Informe o nome da especialidade.");
      return;
    }

    setSubmitting(true);
    try {
      if (editandoId !== null) {
        const atualizada = await atualizarEspecialidade(editandoId, limpo);
        setEspecialidades((atuais) =>
          atuais
            .map((item) => (item.id === editandoId ? atualizada : item))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        );
        showToast("Especialidade atualizada com sucesso.");
      } else {
        const criada = await criarEspecialidade(limpo);
        setEspecialidades((atuais) =>
          [...atuais, criada].sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR")
          )
        );
        showToast("Especialidade cadastrada com sucesso.");
      }
      cancelarEdicao();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemover(item) {
    try {
      await removerEspecialidade(item.id);
      setEspecialidades((atuais) =>
        atuais.filter((esp) => esp.id !== item.id)
      );
      if (editandoId === item.id) {
        cancelarEdicao();
      }
      showToast(`Especialidade "${item.nome}" removida.`);
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">PAINEL ADMINISTRATIVO · UC06</span>
          <h2 className="page-title">Gestão de Especialidades</h2>
          <p className="page-subtitle">
            Cadastre e mantenha as especialidades clínicas disponíveis para
            vincular aos profissionais de saúde.
          </p>
        </div>
      </section>

      <div className="admin-grid">
        <Card
          title={
            editandoId !== null
              ? "Editar especialidade"
              : "Nova especialidade"
          }
          description="O nome deve ser único no catálogo da clínica."
        >
          <form className="admin-form" onSubmit={handleSubmit}>
            <div>
              <label className="form-label" htmlFor="nome-especialidade">
                Nome da especialidade
              </label>
              <input
                id="nome-especialidade"
                type="text"
                className="form-input"
                placeholder="Ex.: Fonoaudiologia, Fisioterapia, Psicologia..."
                maxLength={100}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <p className="field-help">
                Ao remover uma especialidade, os vínculos com profissionais são
                desfeitos automaticamente.
              </p>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="admin-form-actions">
              <Btn type="submit" disabled={submitting}>
                {submitting
                  ? "Salvando..."
                  : editandoId !== null
                    ? "Salvar alterações"
                    : "Cadastrar especialidade"}
              </Btn>

              {editandoId !== null && (
                <Btn variant="secondary" onClick={cancelarEdicao}>
                  Cancelar
                </Btn>
              )}
            </div>
          </form>
        </Card>

        <Card
          title="Especialidades cadastradas"
          description={`${filtradas.length} de ${especialidades.length} especialidade(s)`}
          action={
            <label className="search-field">
              <span className="search-symbol" aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                aria-label="Filtrar especialidades"
                placeholder="Filtrar por nome..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          }
        >
          {loading ? (
            <div className="empty-state">
              <strong>Carregando especialidades...</strong>
            </div>
          ) : filtradas.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">✦</span>
              <strong>Nenhuma especialidade encontrada</strong>
              <p>
                {especialidades.length === 0
                  ? "Utilize o formulário ao lado para cadastrar a primeira especialidade."
                  : "Tente outro termo de pesquisa."}
              </p>
            </div>
          ) : (
            <div className="records-list">
              {filtradas.map((item) => (
                <article className="record-list-row" key={item.id}>
                  <div
                    className="patient-avatar avatar-lavender"
                    aria-hidden="true"
                  >
                    {item.nome.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="record-list-patient">
                    <strong>{item.nome}</strong>
                    <small>Código #{item.id}</small>
                  </div>

                  <div className="admin-row-actions">
                    <Btn
                      variant="outline"
                      size="small"
                      onClick={() => iniciarEdicao(item)}
                    >
                      Editar
                    </Btn>
                    <Btn
                      variant="danger"
                      size="small"
                      onClick={() => handleRemover(item)}
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

