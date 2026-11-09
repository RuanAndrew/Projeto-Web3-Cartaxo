import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Btn from "../../components/Btn.jsx";
import Card from "../../components/Card.jsx";
import { useToast } from "../../components/ToastProvider.jsx";
import {
  DIAS_SEMANA,
  adicionarDisponibilidade,
  atualizarDisponibilidade,
  buscarHorariosDisponiveis,
  formatHora,
  listarDisponibilidades,
  listarEspecialidades,
  listarProfissionais,
  removerDisponibilidade,
} from "../../services/profissionaisApi.js";

const LABEL_POR_DIA = Object.fromEntries(
  DIAS_SEMANA.map((d) => [d.value, d.label])
);

export default function AgendaConfigAdmin() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profissionais, setProfissionais] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [profissionalId, setProfissionalId] = useState(
    searchParams.get("profissional") || ""
  );

  // Disponibilidades do profissional selecionado (UC07)
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  // Formulário de horário
  const [editandoSlotId, setEditandoSlotId] = useState(null);
  const [diaSemana, setDiaSemana] = useState("SEGUNDA");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Consulta de horários disponíveis (UC08)
  const [buscaProfissionalId, setBuscaProfissionalId] = useState("");
  const [buscaEspecialidadeId, setBuscaEspecialidadeId] = useState("");
  const [buscaDia, setBuscaDia] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [loadingBusca, setLoadingBusca] = useState(false);

  useEffect(() => {
    Promise.all([listarProfissionais(), listarEspecialidades()])
      .then(([profs, esps]) => {
        setProfissionais(profs);
        setEspecialidades(esps);
        if (!profissionalId && profs.length > 0) {
          setProfissionalId(String(profs[0].id));
        }
      })
      .catch((err) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarAgenda = useCallback(async (id) => {
    if (!id) {
      setDisponibilidades([]);
      return;
    }
    setLoadingAgenda(true);
    try {
      const lista = await listarDisponibilidades(id);
      setDisponibilidades(lista);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAgenda(false);
    }
  }, []);

  const executarBusca = useCallback(async () => {
    setLoadingBusca(true);
    try {
      const res = await buscarHorariosDisponiveis({
        profissional_id: buscaProfissionalId || undefined,
        especialidade_id: buscaEspecialidadeId || undefined,
        dia_semana: buscaDia || undefined,
      });
      setResultadosBusca(res);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoadingBusca(false);
    }
  }, [buscaProfissionalId, buscaEspecialidadeId, buscaDia, showToast]);

  useEffect(() => {
    carregarAgenda(profissionalId);
  }, [profissionalId, carregarAgenda]);

  useEffect(() => {
    executarBusca();
  }, [executarBusca]);

  const profissionalAtual = useMemo(
    () =>
      profissionais.find((p) => String(p.id) === String(profissionalId)) ||
      null,
    [profissionais, profissionalId]
  );

  const porDia = useMemo(() => {
    const mapa = Object.fromEntries(DIAS_SEMANA.map((d) => [d.value, []]));
    disponibilidades.forEach((slot) => {
      mapa[slot.dia_semana]?.push(slot);
    });
    return mapa;
  }, [disponibilidades]);

  function selecionarProfissional(novoId) {
    setProfissionalId(novoId);
    setSearchParams(novoId ? { profissional: novoId } : {});
    cancelarEdicaoSlot();
  }

  function iniciarEdicaoSlot(slot) {
    setEditandoSlotId(slot.id);
    setDiaSemana(slot.dia_semana);
    setHorarioInicio(formatHora(slot.horario_inicio));
    setHorarioFim(formatHora(slot.horario_fim));
    setError("");
  }

  function cancelarEdicaoSlot() {
    setEditandoSlotId(null);
    setHorarioInicio("08:00");
    setHorarioFim("12:00");
    setError("");
  }

  async function handleSubmitSlot(event) {
    event.preventDefault();
    setError("");

    if (!profissionalId) {
      setError("Selecione um profissional antes de adicionar horários.");
      return;
    }

    if (!horarioInicio || !horarioFim || horarioFim <= horarioInicio) {
      setError("O horário de término deve ser posterior ao horário de início.");
      return;
    }

    const payload = {
      dia_semana: diaSemana,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
    };

    setSubmitting(true);
    try {
      if (editandoSlotId !== null) {
        await atualizarDisponibilidade(editandoSlotId, payload);
        showToast("Horário de atendimento atualizado.");
      } else {
        await adicionarDisponibilidade(profissionalId, payload);
        showToast("Horário adicionado à agenda do profissional.");
      }
      cancelarEdicaoSlot();
      await Promise.all([carregarAgenda(profissionalId), executarBusca()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoverSlot(slot) {
    try {
      await removerDisponibilidade(slot.id);
      if (editandoSlotId === slot.id) {
        cancelarEdicaoSlot();
      }
      showToast("Horário removido.");
      await Promise.all([carregarAgenda(profissionalId), executarBusca()]);
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">
            PAINEL ADMINISTRATIVO · UC07 &amp; UC08
          </span>
          <h2 className="page-title">Configuração de Agenda</h2>
          <p className="page-subtitle">
            Defina os dias da semana e faixas de horário de atendimento de cada
            profissional e consulte a disponibilidade por especialidade.
          </p>
        </div>
      </section>

      <div className="admin-grid">
        <Card
          title={
            editandoSlotId !== null
              ? "Editar faixa de horário"
              : "Adicionar horário de atendimento"
          }
          description="Horários sobrepostos no mesmo dia são bloqueados automaticamente."
        >
          <form className="admin-form" onSubmit={handleSubmitSlot}>
            <div>
              <label className="form-label" htmlFor="agenda-profissional">
                Profissional
              </label>
              <select
                id="agenda-profissional"
                className="form-input"
                value={profissionalId}
                onChange={(e) => selecionarProfissional(e.target.value)}
              >
                <option value="">Selecione um profissional...</option>
                {profissionais.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.nome} ({prof.documento_registro})
                    {!prof.ativo ? " — Inativo" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="form-label">Dia da semana</span>
              <div
                className="day-selector"
                role="group"
                aria-label="Dia da semana"
              >
                {DIAS_SEMANA.map((dia) => (
                  <button
                    key={dia.value}
                    type="button"
                    aria-pressed={diaSemana === dia.value}
                    onClick={() => setDiaSemana(dia.value)}
                    className={`day-pill ${
                      diaSemana === dia.value ? "day-pill-active" : ""
                    }`}
                  >
                    {dia.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="time-row">
              <div>
                <label className="form-label" htmlFor="horario-inicio">
                  Início
                </label>
                <input
                  id="horario-inicio"
                  type="time"
                  className="form-input"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="horario-fim">
                  Término
                </label>
                <input
                  id="horario-fim"
                  type="time"
                  className="form-input"
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="admin-form-actions">
              <Btn
                type="submit"
                disabled={submitting || !profissionalId}
              >
                {submitting
                  ? "Salvando..."
                  : editandoSlotId !== null
                    ? "Atualizar horário"
                    : "Adicionar à agenda"}
              </Btn>

              {editandoSlotId !== null && (
                <Btn variant="secondary" onClick={cancelarEdicaoSlot}>
                  Cancelar
                </Btn>
              )}
            </div>
          </form>
        </Card>

        <Card
          title={
            profissionalAtual
              ? `Grade semanal — ${profissionalAtual.nome}`
              : "Grade semanal do profissional"
          }
          description={
            profissionalAtual
              ? `${disponibilidades.length} faixa(s) configurada(s)`
              : "Selecione um profissional para visualizar e editar os horários."
          }
        >
          {!profissionalId ? (
            <div className="empty-state">
              <span className="empty-state-icon">◷</span>
              <strong>Nenhum profissional selecionado</strong>
              <p>Escolha um profissional no seletor ao lado.</p>
            </div>
          ) : loadingAgenda ? (
            <div className="empty-state">
              <strong>Carregando grade semanal...</strong>
            </div>
          ) : (
            <div className="week-schedule">
              {DIAS_SEMANA.map((dia) => {
                const slots = porDia[dia.value] || [];
                return (
                  <div className="week-day-row" key={dia.value}>
                    <div className="week-day-label">
                      <strong>{dia.label}</strong>
                      <small>
                        {slots.length === 0
                          ? "Sem atendimento"
                          : `${slots.length} faixa(s)`}
                      </small>
                    </div>

                    <div className="week-day-slots">
                      {slots.length === 0 ? (
                        <span className="slot-empty">Livre</span>
                      ) : (
                        slots.map((slot) => (
                          <div className="slot-badge" key={slot.id}>
                            <strong>
                              {formatHora(slot.horario_inicio)} –{" "}
                              {formatHora(slot.horario_fim)}
                            </strong>
                            <button
                              type="button"
                              title="Editar horário"
                              onClick={() => iniciarEdicaoSlot(slot)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              title="Remover horário"
                              onClick={() => handleRemoverSlot(slot)}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Consulta de horários disponíveis (UC08)"
        description="Pesquisa os horários de atendimento dos profissionais ativos filtrando por profissional, especialidade ou dia da semana."
      >
        <div className="admin-filters">
          <select
            className="form-input admin-select"
            aria-label="Filtrar busca por especialidade"
            value={buscaEspecialidadeId}
            onChange={(e) => setBuscaEspecialidadeId(e.target.value)}
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
            aria-label="Filtrar busca por profissional"
            value={buscaProfissionalId}
            onChange={(e) => setBuscaProfissionalId(e.target.value)}
          >
            <option value="">Todos os profissionais ativos</option>
            {profissionais
              .filter((p) => p.ativo)
              .map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.nome}
                </option>
              ))}
          </select>

          <select
            className="form-input admin-select"
            aria-label="Filtrar busca por dia da semana"
            value={buscaDia}
            onChange={(e) => setBuscaDia(e.target.value)}
          >
            <option value="">Todos os dias da semana</option>
            {DIAS_SEMANA.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {loadingBusca ? (
          <div className="empty-state">
            <strong>Consultando horários...</strong>
          </div>
        ) : resultadosBusca.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">⌕</span>
            <strong>Nenhum horário disponível para esses filtros</strong>
            <p>
              Apenas profissionais ativos e com horários configurados aparecem
              nesta consulta.
            </p>
          </div>
        ) : (
          <div className="records-list">
            {resultadosBusca.map((item) => (
              <article
                className="record-list-row"
                key={item.disponibilidade_id}
              >
                <div
                  className="patient-avatar avatar-blue"
                  aria-hidden="true"
                >
                  {DIAS_SEMANA.find((d) => d.value === item.dia_semana)?.short}
                </div>

                <div className="record-list-patient">
                  <strong>{item.profissional_nome}</strong>
                  <span>
                    {LABEL_POR_DIA[item.dia_semana]} ·{" "}
                    {formatHora(item.horario_inicio)} às{" "}
                    {formatHora(item.horario_fim)}
                  </span>
                  {item.especialidades.length > 0 && (
                    <div className="tag-list">
                      {item.especialidades.map((esp) => (
                        <span key={esp.id} className="specialty-tag">
                          {esp.nome}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

