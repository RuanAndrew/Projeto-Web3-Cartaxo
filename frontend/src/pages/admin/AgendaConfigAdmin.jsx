import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Btn from "../../components/Btn.jsx";
import { useToast } from "../../components/ToastProvider.jsx";
import {
  DIAS_SEMANA,
  adicionarDisponibilidade,
  atualizarDisponibilidade,
  buscarHorariosDisponiveis,
  diaSemanaDeData,
  formatDataBR,
  formatDataExtenso,
  formatHora,
  hojeIso,
  listarDisponibilidades,
  listarEspecialidades,
  listarProfissionais,
  proximaDataParaDiaSemana,
  removerDisponibilidade,
  somarDiasIso,
} from "../../services/profissionaisApi.js";

const LABEL_POR_DIA = Object.fromEntries(
  DIAS_SEMANA.map((d) => [d.value, d.label])
);

const TURNOS_RAPIDOS = [
  { label: "Manhã (08h–12h)", inicio: "08:00", fim: "12:00" },
  { label: "Tarde (13h–17h)", inicio: "13:00", fim: "17:00" },
  { label: "Integral (08h–18h)", inicio: "08:00", fim: "18:00" },
];

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

  // Formulário de horário e data de atendimento
  const dataInicial = useMemo(() => hojeIso(), []);
  const [editandoSlotId, setEditandoSlotId] = useState(null);
  const [dataAtendimento, setDataAtendimento] = useState(dataInicial);
  const [diaSemana, setDiaSemana] = useState(() =>
    diaSemanaDeData(dataInicial)
  );
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Consulta de horários disponíveis (UC08)
  const [buscaProfissionalId, setBuscaProfissionalId] = useState("");
  const [buscaEspecialidadeId, setBuscaEspecialidadeId] = useState("");
  const [buscaDia, setBuscaDia] = useState("");
  const [buscaData, setBuscaData] = useState("");
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
        data_atendimento: buscaData || undefined,
      });
      setResultadosBusca(res);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoadingBusca(false);
    }
  }, [
    buscaProfissionalId,
    buscaEspecialidadeId,
    buscaDia,
    buscaData,
    showToast,
  ]);

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

  function handleChangeDataAtendimento(novaData) {
    setDataAtendimento(novaData);
    if (novaData) {
      setDiaSemana(diaSemanaDeData(novaData));
    }
  }

  function handleSelectDiaSemana(novoDia) {
    setDiaSemana(novoDia);
    if (dataAtendimento) {
      setDataAtendimento(proximaDataParaDiaSemana(novoDia, hojeIso()));
    }
  }

  function iniciarEdicaoSlot(slot) {
    setEditandoSlotId(slot.id);
    setDiaSemana(slot.dia_semana);
    setDataAtendimento(slot.data_atendimento || "");
    setHorarioInicio(formatHora(slot.horario_inicio));
    setHorarioFim(formatHora(slot.horario_fim));
    setError("");
  }

  function cancelarEdicaoSlot() {
    const hoje = hojeIso();
    setEditandoSlotId(null);
    setDataAtendimento(hoje);
    setDiaSemana(diaSemanaDeData(hoje));
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

    const diaFinal = dataAtendimento
      ? diaSemanaDeData(dataAtendimento)
      : diaSemana;

    const payload = {
      dia_semana: diaFinal,
      data_atendimento: dataAtendimento || null,
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

  const totalAtivos = useMemo(
    () => profissionais.filter((p) => p.ativo).length,
    [profissionais]
  );

  const temFiltroBusca = Boolean(
    buscaEspecialidadeId || buscaProfissionalId || buscaDia || buscaData
  );

  function limparFiltrosBusca() {
    setBuscaEspecialidadeId("");
    setBuscaProfissionalId("");
    setBuscaDia("");
    setBuscaData("");
  }

  return (
    <div className="page-stack schedule-page">
      <section className="schedule-hero-banner">
        <div className="schedule-hero-copy">
          <span className="eyebrow">
            PAINEL ADMINISTRATIVO · UC07 &amp; UC08
          </span>
          <h2 className="page-title">Configuração de Agenda</h2>
          <p className="page-subtitle">
            Defina os dias da semana e faixas de horário de atendimento de cada
            profissional e consulte a disponibilidade por especialidade.
          </p>
        </div>

        <div className="schedule-kpi-group" aria-label="Resumo da agenda">
          <div className="schedule-kpi-pill">
            <span className="schedule-kpi-label">Profissionais ativos</span>
            <strong className="schedule-kpi-value">{totalAtivos}</strong>
          </div>
          <div className="schedule-kpi-pill">
            <span className="schedule-kpi-label">Especialidades</span>
            <strong className="schedule-kpi-value">
              {especialidades.length}
            </strong>
          </div>
          <div className="schedule-kpi-pill schedule-kpi-pill-highlight">
            <span className="schedule-kpi-label">Faixas do profissional</span>
            <strong className="schedule-kpi-value">
              {profissionalId ? disponibilidades.length : "—"}
            </strong>
          </div>
        </div>
      </section>

      <div className="schedule-section-divider">
        <span className="schedule-section-step">ETAPA 1 · UC07</span>
        <h3 className="schedule-section-heading">
          Grade de Atendimento do Profissional
        </h3>
        <span className="schedule-section-line" aria-hidden="true" />
      </div>

      <div className="admin-grid schedule-main-grid">
        <section className="schedule-panel">
          <header className="schedule-panel-header">
            <div className="schedule-panel-header-main">
              <span
                className="schedule-panel-icon schedule-panel-icon-blue"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15.5 14" />
                </svg>
              </span>
              <div>
                <h2 className="card-title">
                  {editandoSlotId !== null
                    ? "Editar faixa de horário"
                    : "Adicionar horário de atendimento"}
                </h2>
                <p className="card-description">
                  Configure o expediente semanal por profissional.
                </p>
              </div>
            </div>

            {editandoSlotId !== null && (
              <span className="schedule-header-badge schedule-badge-editing">
                Modo edição
              </span>
            )}
          </header>

          <div className="schedule-panel-body">
            <form className="admin-form" onSubmit={handleSubmitSlot}>
              <div className="schedule-field-group">
                <div className="schedule-field-head">
                  <span className="schedule-step-num">1</span>
                  <label className="form-label" htmlFor="agenda-profissional">
                    Profissional
                  </label>
                </div>
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

              <div className="schedule-field-group">
                <div className="schedule-field-head schedule-field-head-between">
                  <div className="schedule-field-head-left">
                    <span className="schedule-step-num">2</span>
                    <label
                      className="form-label"
                      htmlFor="agenda-data-atendimento"
                    >
                      Data do atendimento
                    </label>
                  </div>

                  <div
                    className="schedule-date-shortcuts"
                    role="group"
                    aria-label="Atalhos de data"
                  >
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        dataAtendimento === hojeIso()
                          ? "date-shortcut-chip-active"
                          : ""
                      }`}
                      onClick={() => handleChangeDataAtendimento(hojeIso())}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        dataAtendimento === somarDiasIso(hojeIso(), 1)
                          ? "date-shortcut-chip-active"
                          : ""
                      }`}
                      onClick={() =>
                        handleChangeDataAtendimento(somarDiasIso(hojeIso(), 1))
                      }
                    >
                      Amanhã
                    </button>
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        dataAtendimento === somarDiasIso(hojeIso(), 7)
                          ? "date-shortcut-chip-active"
                          : ""
                      }`}
                      onClick={() =>
                        handleChangeDataAtendimento(somarDiasIso(hojeIso(), 7))
                      }
                    >
                      +7 dias
                    </button>
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        !dataAtendimento ? "date-shortcut-chip-active" : ""
                      }`}
                      onClick={() => handleChangeDataAtendimento("")}
                    >
                      Fixo semanal
                    </button>
                  </div>
                </div>

                <div className="schedule-date-picker-wrap">
                  <input
                    id="agenda-data-atendimento"
                    type="date"
                    className="form-input schedule-date-input"
                    value={dataAtendimento}
                    onChange={(e) =>
                      handleChangeDataAtendimento(e.target.value)
                    }
                  />

                  <div className="schedule-date-preview">
                    <span className="schedule-date-preview-icon" aria-hidden="true">
                      {dataAtendimento ? "📅" : "↻"}
                    </span>
                    <span>
                      {dataAtendimento ? (
                        <>
                          Atendimento em{" "}
                          <strong>{formatDataExtenso(dataAtendimento)}</strong>
                        </>
                      ) : (
                        <>
                          Expediente recorrente toda{" "}
                          <strong>{LABEL_POR_DIA[diaSemana]}</strong>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="schedule-weekday-subblock">
                  <span className="time-sublabel">
                    Dia da semana correspondente
                  </span>
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
                        onClick={() => handleSelectDiaSemana(dia.value)}
                        className={`day-pill ${
                          diaSemana === dia.value ? "day-pill-active" : ""
                        }`}
                      >
                        {dia.short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="schedule-field-group">
                <div className="schedule-field-head schedule-field-head-between">
                  <div className="schedule-field-head-left">
                    <span className="schedule-step-num">3</span>
                    <span className="form-label">Faixa de horário</span>
                  </div>

                  <div
                    className="schedule-date-shortcuts"
                    role="group"
                    aria-label="Turnos rápidos"
                  >
                    {TURNOS_RAPIDOS.map((turno) => {
                      const ativo =
                        horarioInicio === turno.inicio &&
                        horarioFim === turno.fim;
                      return (
                        <button
                          key={turno.label}
                          type="button"
                          className={`date-shortcut-chip ${
                            ativo ? "date-shortcut-chip-active" : ""
                          }`}
                          onClick={() => {
                            setHorarioInicio(turno.inicio);
                            setHorarioFim(turno.fim);
                          }}
                        >
                          {turno.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="time-row">
                  <div className="time-input-col">
                    <label className="time-sublabel" htmlFor="horario-inicio">
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

                  <span className="time-range-arrow" aria-hidden="true">
                    →
                  </span>

                  <div className="time-input-col">
                    <label className="time-sublabel" htmlFor="horario-fim">
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
              </div>

              <div className="schedule-rule-box">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  Horários sobrepostos no mesmo dia são bloqueados
                  automaticamente.
                </span>
              </div>

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <div className="admin-form-actions">
                <Btn
                  type="submit"
                  className="btn-block"
                  disabled={submitting || !profissionalId}
                >
                  {submitting
                    ? "Salvando..."
                    : editandoSlotId !== null
                      ? "Atualizar horário"
                      : "+ Adicionar à agenda"}
                </Btn>

                {editandoSlotId !== null && (
                  <Btn
                    variant="secondary"
                    className="btn-block"
                    onClick={cancelarEdicaoSlot}
                  >
                    Cancelar edição
                  </Btn>
                )}
              </div>
            </form>
          </div>
        </section>

        <section className="schedule-panel">
          <header className="schedule-panel-header">
            <div className="schedule-panel-header-main">
              <span
                className="schedule-panel-icon schedule-panel-icon-indigo"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div>
                <h2 className="card-title">
                  {profissionalAtual
                    ? `Grade semanal — ${profissionalAtual.nome}`
                    : "Grade semanal do profissional"}
                </h2>
                <p className="card-description">
                  {profissionalAtual
                    ? `Registro ${profissionalAtual.documento_registro} · Visualize ou edite as faixas por dia da semana.`
                    : "Selecione um profissional para visualizar e editar os horários."}
                </p>
              </div>
            </div>

            <span
              className={`schedule-header-badge ${
                profissionalAtual
                  ? disponibilidades.length > 0
                    ? "schedule-badge-active"
                    : "schedule-badge-neutral"
                  : "schedule-badge-neutral"
              }`}
            >
              {profissionalAtual
                ? `${disponibilidades.length} faixa(s) configurada(s)`
                : "Aguardando seleção"}
            </span>
          </header>

          <div className="schedule-panel-body schedule-panel-body-fill">
            {!profissionalId ? (
              <div className="schedule-empty-box">
                <span className="schedule-empty-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <circle cx="12" cy="15" r="2" />
                  </svg>
                </span>
                <strong>Nenhum profissional selecionado</strong>
                <p>
                  Escolha um profissional no passo <strong>1</strong> ao lado
                  para carregar os dias da semana e gerenciar os horários de
                  atendimento.
                </p>
              </div>
            ) : loadingAgenda ? (
              <div className="schedule-empty-box">
                <strong>Carregando grade semanal...</strong>
              </div>
            ) : (
              <div className="week-schedule">
                {DIAS_SEMANA.map((dia) => {
                  const slots = porDia[dia.value] || [];
                  const possuiSlots = slots.length > 0;
                  return (
                    <div
                      className={`week-day-row ${
                        possuiSlots
                          ? "week-day-row-filled"
                          : "week-day-row-empty"
                      }`}
                      key={dia.value}
                    >
                      <div className="week-day-label">
                        <span className="week-day-abbr">{dia.short}</span>
                        <div>
                          <strong>{dia.label}</strong>
                          <small>
                            {!possuiSlots
                              ? "Sem atendimento"
                              : `${slots.length} faixa(s) ativa(s)`}
                          </small>
                        </div>
                      </div>

                      <div className="week-day-slots">
                        {!possuiSlots ? (
                          <span className="slot-empty">Livre</span>
                        ) : (
                          slots.map((slot) => (
                            <div className="slot-badge" key={slot.id}>
                              <span
                                className={`slot-date-chip ${
                                  slot.data_atendimento
                                    ? "slot-date-chip-specific"
                                    : "slot-date-chip-recurring"
                                }`}
                              >
                                {slot.data_atendimento
                                  ? `📅 ${formatDataBR(slot.data_atendimento)}`
                                  : "↻ Semanal"}
                              </span>
                              <strong>
                                {formatHora(slot.horario_inicio)} –{" "}
                                {formatHora(slot.horario_fim)}
                              </strong>
                              <button
                                type="button"
                                className="slot-action-btn"
                                title="Editar horário"
                                onClick={() => iniciarEdicaoSlot(slot)}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                className="slot-action-btn slot-action-remove"
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
          </div>
        </section>
      </div>

      <div className="schedule-section-divider">
        <span className="schedule-section-step">ETAPA 2 · UC08</span>
        <h3 className="schedule-section-heading">
          Consulta Geral de Disponibilidade
        </h3>
        <span className="schedule-section-line" aria-hidden="true" />
      </div>

      <section className="schedule-panel">
        <header className="schedule-panel-header">
          <div className="schedule-panel-header-main">
            <span
              className="schedule-panel-icon schedule-panel-icon-teal"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <div>
              <h2 className="card-title">
                Consulta de horários disponíveis (UC08)
              </h2>
              <p className="card-description">
                Pesquisa os horários de atendimento dos profissionais ativos
                filtrando por data, profissional, especialidade ou dia da semana.
              </p>
            </div>
          </div>

          <span className="schedule-header-badge schedule-badge-neutral">
            {resultadosBusca.length} horário(s) encontrado(s)
          </span>
        </header>

        <div className="schedule-panel-body">
          <div className="schedule-filter-bar schedule-filter-bar-4cols">
            <div className="schedule-filter-field">
              <label
                className="schedule-filter-label"
                htmlFor="filtro-especialidade-uc08"
              >
                Especialidade
              </label>
              <select
                id="filtro-especialidade-uc08"
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
            </div>

            <div className="schedule-filter-field">
              <label
                className="schedule-filter-label"
                htmlFor="filtro-profissional-uc08"
              >
                Profissional ativo
              </label>
              <select
                id="filtro-profissional-uc08"
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
            </div>

            <div className="schedule-filter-field">
              <label
                className="schedule-filter-label"
                htmlFor="filtro-data-uc08"
              >
                Data do atendimento
              </label>
              <input
                id="filtro-data-uc08"
                type="date"
                className="form-input admin-select"
                aria-label="Filtrar busca por data do atendimento"
                value={buscaData}
                onChange={(e) => setBuscaData(e.target.value)}
              />
            </div>

            <div className="schedule-filter-field">
              <label
                className="schedule-filter-label"
                htmlFor="filtro-dia-uc08"
              >
                Dia da semana
              </label>
              <select
                id="filtro-dia-uc08"
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

            {temFiltroBusca && (
              <div className="schedule-filter-reset">
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={limparFiltrosBusca}
                >
                  Limpar filtros
                </Btn>
              </div>
            )}
          </div>

          {loadingBusca ? (
            <div className="schedule-empty-box schedule-empty-box-compact">
              <strong>Consultando horários...</strong>
            </div>
          ) : resultadosBusca.length === 0 ? (
            <div className="schedule-empty-box schedule-empty-box-compact">
              <span className="schedule-empty-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <strong>Nenhum horário disponível para esses filtros</strong>
              <p>
                Apenas profissionais ativos e com horários configurados aparecem
                nesta consulta.
              </p>
            </div>
          ) : (
            <div className="availability-results-grid">
              {resultadosBusca.map((item) => (
                <article
                  className="availability-result-card"
                  key={item.disponibilidade_id}
                >
                  <div
                    className="patient-avatar avatar-blue"
                    aria-hidden="true"
                  >
                    {
                      DIAS_SEMANA.find((d) => d.value === item.dia_semana)
                        ?.short
                    }
                  </div>

                  <div className="record-list-patient">
                    <div className="availability-card-top">
                      <strong>{item.profissional_nome}</strong>
                      <span className="availability-time-pill">
                        {formatHora(item.horario_inicio)} às{" "}
                        {formatHora(item.horario_fim)}
                      </span>
                    </div>
                    <div className="availability-meta-line">
                      <span>{LABEL_POR_DIA[item.dia_semana]}</span>
                      <span
                        className={`slot-date-chip ${
                          item.data_atendimento
                            ? "slot-date-chip-specific"
                            : "slot-date-chip-recurring"
                        }`}
                      >
                        {item.data_atendimento
                          ? `📅 ${formatDataBR(item.data_atendimento)}`
                          : "↻ Semanal"}
                      </span>
                    </div>
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
        </div>
      </section>
    </div>
  );
}

