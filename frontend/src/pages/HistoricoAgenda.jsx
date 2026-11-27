import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import { listarProfissionais } from "../services/profissionaisApi.js";
import {
  garantirSessaoValida,
  lerPayload,
  obterToken,
  removerToken,
} from "../utils/auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFISSIONAL_UUID_PADRAO = "119d0caf-2b76-4782-85a5-65937af47356";

async function fetchComSessao(url, options = {}) {
  let token = obterToken() || (await garantirSessaoValida());
  const montarHeaders = (t) => ({
    ...(options.headers || {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  let response = await fetch(url, {
    ...options,
    headers: montarHeaders(token),
  });

  if (response.status === 401) {
    removerToken();
    token = await garantirSessaoValida();
    if (token) {
      response = await fetch(url, {
        ...options,
        headers: montarHeaders(token),
      });
    }
  }

  return response;
}

function resolverUuidProfissional(prof, index = 0, usuarioAtual = null) {
  const idStr = String(prof?.id || "").trim();
  if (UUID_REGEX.test(idStr)) return idStr;
  if (index === 0) {
    if (
      usuarioAtual?.perfil === "PROFISSIONAL" &&
      UUID_REGEX.test(String(usuarioAtual?.sub || ""))
    ) {
      return String(usuarioAtual.sub);
    }
    return PROFISSIONAL_UUID_PADRAO;
  }
  const sufixo =
    idStr.replace(/\D/g, "").padStart(12, "0").slice(-12) ||
    String(index + 1).padStart(12, "0");
  return `00000000-0000-4000-8000-${sufixo}`;
}

function obterNomePaciente(paciente) {
  return String(paciente?.nome_completo || paciente?.nome || "").trim();
}

function indexarPaciente(mapa, paciente) {
  if (!paciente) return;
  if (paciente.id) {
    mapa[String(paciente.id).toLowerCase()] = paciente;
  }
  if (paciente.user_account_id) {
    mapa[String(paciente.user_account_id).toLowerCase()] = paciente;
  }
}

function initialsFromName(name) {
  const partes = String(name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zÀ-ÿ]/g, ""))
    .filter(Boolean);
  if (partes.length === 0) return "PC";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function formatDateShort(value) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateHeading(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obterDataLocalIso(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterHojeLocalIso() {
  return obterDataLocalIso(new Date());
}

function ehAgendamentoDeDataPassada(dataHora) {
  const dataAg = obterDataLocalIso(dataHora);
  if (!dataAg) return false;
  return dataAg < obterHojeLocalIso();
}

function ehAgendamentoFuturo(dataHora) {
  const dataAg = obterDataLocalIso(dataHora);
  if (!dataAg) return false;
  return dataAg > obterHojeLocalIso();
}

function minutosDoDiaLocal(dataHora) {
  if (!dataHora) return 0;
  const d = new Date(dataHora);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function getAppointmentStatus(status) {
  const statuses = {
    agendado: {
      label: "Programado",
      key: "confirmed",
    },
    cancelado: {
      label: "Cancelado",
      key: "cancelled",
    },
    nao_compareceu: {
      label: "Não compareceu",
      key: "noshow",
    },
    concluido: {
      label: "Concluído",
      key: "completed",
    },
    concluída: {
      label: "Concluído",
      key: "completed",
    },
    aguardando: {
      label: "Em espera",
      key: "waiting",
    },
  };

  return (
    statuses[String(status || "").toLowerCase()] || {
      label: status || "Programado",
      key: "confirmed",
    }
  );
}

const FILTROS_HISTORICO = [
  { id: "Todos", label: "Todos" },
  { id: "completed", label: "Concluídos" },
  { id: "cancelled", label: "Cancelados" },
  { id: "noshow", label: "Não compareceu" },
];

const FILTROS_FUTURO = [
  { id: "Todos", label: "Todos" },
  { id: "confirmed", label: "Programados" },
  { id: "cancelled", label: "Cancelados" },
];

export default function HistoricoAgenda() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const abaParam = searchParams.get("aba");
  const [activeTab, setActiveTab] = useState(
    abaParam === "futuro" ? "futuro" : "historico"
  );

  useEffect(() => {
    if (abaParam === "futuro" || abaParam === "historico") {
      setActiveTab(abaParam);
    }
  }, [abaParam]);

  const [appointments, setAppointments] = useState([]);
  const [pacientesMap, setPacientesMap] = useState({});
  const [profissionaisLista, setProfissionaisLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [busyActionId, setBusyActionId] = useState(null);
  const [avisoExpirados, setAvisoExpirados] = useState("");

  const usuarioAtual = useMemo(() => {
    const token = obterToken();
    return token ? lerPayload(token) : null;
  }, []);

  function trocarAba(novaAba) {
    setActiveTab(novaAba);
    setStatusFilter("Todos");
    setDateFilter("");
    setAvisoExpirados("");
    setSearchParams({ aba: novaAba });
  }

  async function carregarCatalogos() {
    const mapa = {};
    try {
      const respPac = await fetchComSessao(
        `${API_URL}/api/v1/pacientes?limit=100`
      );
      if (respPac.ok) {
        const dadosPac = await respPac.json();
        const lista = Array.isArray(dadosPac)
          ? dadosPac
          : Array.isArray(dadosPac?.items)
            ? dadosPac.items
            : [];
        for (const p of lista) {
          indexarPaciente(mapa, p);
        }
        setPacientesMap((prev) => ({ ...prev, ...mapa }));
      }
    } catch {
      /* fallback */
    }

    try {
      const dadosProf = await listarProfissionais({ ativo: true });
      const listaProf = (Array.isArray(dadosProf) ? dadosProf : []).map(
        (prof, idx) => ({
          ...prof,
          uuid: resolverUuidProfissional(prof, idx, usuarioAtual),
        })
      );
      setProfissionaisLista(listaProf);
    } catch {
      /* fallback */
    }

    return mapa;
  }

  async function carregarPacientesPorIds(ids, mapaExistente = {}) {
    const faltantes = [
      ...new Set(
        ids
          .map((id) => String(id || "").trim())
          .filter(
            (id) => UUID_REGEX.test(id) && !mapaExistente[id.toLowerCase()]
          )
      ),
    ];

    if (faltantes.length === 0) return;

    const encontrados = await Promise.all(
      faltantes.map(async (pid) => {
        try {
          const resp = await fetchComSessao(
            `${API_URL}/api/v1/pacientes/${pid}`
          );
          if (!resp.ok) return null;
          return await resp.json();
        } catch {
          return null;
        }
      })
    );

    const extras = {};
    for (const pac of encontrados) {
      if (pac) indexarPaciente(extras, pac);
    }
    if (Object.keys(extras).length > 0) {
      setPacientesMap((prev) => ({ ...prev, ...extras }));
    }
  }

  async function loadAppointments() {
    setLoading(true);
    setError("");

    try {
      const response = await fetchComSessao(`${API_URL}/agendamentos`);
      if (!response.ok) {
        throw new Error("Não foi possível carregar os registros da agenda.");
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Formato de resposta inválido.");
      }

      const vencidosPendentes = data.filter(
        (apt) =>
          (apt.status === "agendado" || apt.status === "aguardando") &&
          ehAgendamentoDeDataPassada(apt.data_hora)
      );

      let listaNormalizada = data;
      if (vencidosPendentes.length > 0) {
        await Promise.all(
          vencidosPendentes.map((apt) =>
            fetchComSessao(`${API_URL}/agendamentos/${apt.id}/cancelar`, {
              method: "PATCH",
            }).catch(() => null)
          )
        );
        listaNormalizada = data.map((apt) =>
          (apt.status === "agendado" || apt.status === "aguardando") &&
          ehAgendamentoDeDataPassada(apt.data_hora)
            ? { ...apt, status: "cancelado", canceladoPorPrazo: true }
            : apt
        );
      }

      setAppointments(listaNormalizada);
      return listaNormalizada;
    } catch (err) {
      setError(err.message || "Erro ao carregar histórico e agenda futura.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    async function inicializar() {
      const [mapaInicial, agendamentosCarregados] = await Promise.all([
        carregarCatalogos(),
        loadAppointments(),
      ]);
      if (!ativo || !Array.isArray(agendamentosCarregados)) return;
      await carregarPacientesPorIds(
        agendamentosCarregados.map((apt) => apt.paciente_id),
        mapaInicial
      );
    }
    inicializar();
    return () => {
      ativo = false;
    };
  }, []);

  const profissionaisMap = useMemo(() => {
    const mapa = {};
    for (const prof of profissionaisLista) {
      if (prof?.id) mapa[String(prof.id).toLowerCase()] = prof;
      if (prof?.uuid) mapa[String(prof.uuid).toLowerCase()] = prof;
    }
    return mapa;
  }, [profissionaisLista]);

  const enrichedAppointments = useMemo(() => {
    return appointments.map((apt) => {
      const dataIso = obterDataLocalIso(apt.data_hora);
      const dataPassada = ehAgendamentoDeDataPassada(apt.data_hora);
      const dataFutura = ehAgendamentoFuturo(apt.data_hora);
      const statusNormalizado =
        dataPassada &&
        (apt.status === "agendado" || apt.status === "aguardando")
          ? "cancelado"
          : apt.status;
      const statusInfo = getAppointmentStatus(statusNormalizado);
      const pac = pacientesMap[String(apt.paciente_id || "").toLowerCase()];
      const prof =
        profissionaisMap[String(apt.profissional_id || "").toLowerCase()];
      const especialidadeProf =
        prof?.especialidades?.[0]?.nome || "Atendimento Clínico";
      const isTeleconsulta = apt.modalidade === "teleconsulta";
      const nomePaciente = obterNomePaciente(pac);

      return {
        ...apt,
        dataIso,
        status: statusNormalizado,
        dataPassada,
        dataFutura,
        statusInfo,
        isTeleconsulta,
        pacienteInfo: {
          nome: nomePaciente || "Paciente cadastrado",
          iniciais: nomePaciente ? initialsFromName(nomePaciente) : "PC",
          especialidade: especialidadeProf,
          profissionalNome: prof?.nome || null,
          modalidadeLabel: isTeleconsulta ? "Teleconsulta" : "Presencial",
        },
      };
    });
  }, [appointments, pacientesMap, profissionaisMap]);

  const pastAppointments = useMemo(
    () => enrichedAppointments.filter((apt) => apt.dataPassada),
    [enrichedAppointments]
  );

  const futureAppointments = useMemo(
    () => enrichedAppointments.filter((apt) => apt.dataFutura),
    [enrichedAppointments]
  );

  const pastStats = useMemo(() => {
    let completed = 0;
    let cancelled = 0;
    let noshow = 0;
    for (const apt of pastAppointments) {
      if (apt.statusInfo.key === "completed") completed += 1;
      else if (apt.statusInfo.key === "noshow") noshow += 1;
      else cancelled += 1;
    }
    return {
      total: pastAppointments.length,
      completed,
      cancelled,
      noshow,
    };
  }, [pastAppointments]);

  const futureStats = useMemo(() => {
    let confirmed = 0;
    let cancelled = 0;
    for (const apt of futureAppointments) {
      if (
        apt.statusInfo.key === "cancelled" ||
        apt.statusInfo.key === "noshow"
      ) {
        cancelled += 1;
      } else {
        confirmed += 1;
      }
    }
    return {
      total: futureAppointments.length,
      confirmed,
      cancelled,
    };
  }, [futureAppointments]);

  const activeList =
    activeTab === "futuro" ? futureAppointments : pastAppointments;

  const filteredList = useMemo(() => {
    const search = query.trim().toLowerCase();

    return activeList
      .filter((apt) => {
        const { statusInfo, pacienteInfo } = apt;

        const matchesDate = !dateFilter || apt.dataIso === dateFilter;

        const matchesStatus =
          statusFilter === "Todos" ||
          (statusFilter === "confirmed" &&
            (statusInfo.key === "confirmed" || statusInfo.key === "waiting")) ||
          statusInfo.key === statusFilter;

        const matchesSearch =
          !search ||
          pacienteInfo.nome.toLowerCase().includes(search) ||
          pacienteInfo.especialidade.toLowerCase().includes(search) ||
          pacienteInfo.modalidadeLabel.toLowerCase().includes(search) ||
          formatDateShort(apt.data_hora).includes(search);

        return matchesDate && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        if (a.dataIso !== b.dataIso) {
          // No futuro: data mais próxima primeiro; no histórico: data mais recente primeiro
          return activeTab === "futuro"
            ? a.dataIso.localeCompare(b.dataIso)
            : b.dataIso.localeCompare(a.dataIso);
        }
        // Dentro da mesma data: do horário mais cedo para o mais tarde
        return minutosDoDiaLocal(a.data_hora) - minutosDoDiaLocal(b.data_hora);
      });
  }, [activeList, query, dateFilter, statusFilter, activeTab]);

  // Agrupamento por data para leitura clara do histórico e da agenda futura
  const groupedByDate = useMemo(() => {
    const groups = [];
    const map = new Map();

    for (const apt of filteredList) {
      const key = apt.dataIso || "sem-data";
      if (!map.has(key)) {
        const group = {
          dateIso: key,
          dateShort: formatDateShort(apt.data_hora),
          dateHeading: formatDateHeading(key),
          items: [],
        };
        map.set(key, group);
        groups.push(group);
      }
      map.get(key).items.push(apt);
    }

    return groups;
  }, [filteredList]);

  function handleTentativaRetomarPassado(appointment) {
    const msg = `A consulta de ${appointment.pacienteInfo.nome} (${formatDateShort(
      appointment.data_hora
    )}) é de uma data passada, foi encerrada e não pode ser retomada.`;
    setAvisoExpirados(msg);
  }

  async function handleCancelarFuturo(appointment) {
    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);
    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/cancelar`,
        { method: "PATCH" }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível cancelar o agendamento futuro."
        );
      }
      const atualizado = await response.json();
      setAppointments((curr) =>
        curr.map((item) => (item.id === appointment.id ? atualizado : item))
      );
      showToast("Agendamento futuro cancelado.");
    } catch (err) {
      showToast(err.message || "Erro ao cancelar agendamento.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleRetomarFuturo(appointment) {
    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);
    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/reativar`,
        { method: "PATCH" }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível retomar o agendamento futuro."
        );
      }
      const atualizado = await response.json();
      setAppointments((curr) =>
        curr.map((item) => (item.id === appointment.id ? atualizado : item))
      );
      showToast(
        `Consulta futura de ${appointment.pacienteInfo.nome} retomada.`
      );
    } catch (err) {
      showToast(err.message || "Erro ao retomar agendamento.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleExcluirFuturo(appointment) {
    if (appointment.dataPassada) return;
    const confirmou = window.confirm(
      `Deseja realmente excluir o agendamento futuro de ${appointment.pacienteInfo.nome}?`
    );
    if (!confirmou) return;

    setBusyActionId(appointment.id);
    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível excluir o agendamento."
        );
      }
      setAppointments((curr) =>
        curr.filter((item) => item.id !== appointment.id)
      );
      showToast("Agendamento futuro excluído.");
    } catch (err) {
      showToast(err.message || "Erro ao excluir agendamento.");
    } finally {
      setBusyActionId(null);
    }
  }

  const filtrosAtuais =
    activeTab === "futuro" ? FILTROS_FUTURO : FILTROS_HISTORICO;

  return (
    <div className="page-stack">
      <Card className="doctor-schedule-board">
        <header className="doctor-schedule-board-header">
          <div className="doctor-schedule-title-row">
            <div>
              <h2 className="card-title">Consultas</h2>
            </div>

            <div className="doctor-board-header-right">
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => navigate("/agenda")}
              >
                ← Voltar para Agenda
              </Btn>
            </div>
          </div>

          {/* SELETOR PRINCIPAL: HISTÓRICO vs PRÓXIMOS AGENDAMENTOS */}
          <div className="history-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "historico"}
              className={`history-mode-tab ${
                activeTab === "historico" ? "history-mode-tab-active" : ""
              }`}
              onClick={() => trocarAba("historico")}
            >
              <div className="history-mode-tab-title">
                <span>🕘 Histórico</span>
                <span className="history-mode-tab-badge">
                  {pastAppointments.length}
                </span>
              </div>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "futuro"}
              className={`history-mode-tab ${
                activeTab === "futuro" ? "history-mode-tab-active" : ""
              }`}
              onClick={() => trocarAba("futuro")}
            >
              <div className="history-mode-tab-title">
                <span>📅 Próximos agendamentos</span>
                <span className="history-mode-tab-badge">
                  {futureAppointments.length}
                </span>
              </div>
            </button>
          </div>

          {/* RESUMO RÁPIDO DA ABA SELECIONADA */}
          {activeTab === "historico" ? (
            <div className="history-kpi-bar">
              <span className="calendar-summary-chip calendar-summary-chip-confirmed">
                Total: {pastStats.total}
              </span>
              <span className="calendar-summary-chip calendar-summary-chip-completed">
                ✓ Realizadas: {pastStats.completed}
              </span>
              <span className="calendar-summary-chip calendar-summary-chip-cancelled">
                ✕ Canceladas: {pastStats.cancelled}
              </span>
              <span className="calendar-summary-chip calendar-summary-chip-noshow">
                ⊘ Não compareceu: {pastStats.noshow}
              </span>
            </div>
          ) : (
            <div className="history-kpi-bar">
              <span className="calendar-summary-chip calendar-summary-chip-confirmed">
                Total agendado: {futureStats.total}
              </span>
              <span className="calendar-summary-chip calendar-summary-chip-completed">
                ◷ Programadas: {futureStats.confirmed}
              </span>
              {futureStats.cancelled > 0 && (
                <span className="calendar-summary-chip calendar-summary-chip-cancelled">
                  ✕ Canceladas: {futureStats.cancelled}
                </span>
              )}
            </div>
          )}

          {/* CONTROLES DE FILTRO POR STATUS, DATA E BUSCA */}
          <div className="doctor-schedule-controls">
            <div
              className="records-specialty-pills"
              role="group"
              aria-label="Filtrar por status"
            >
              {filtrosAtuais.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`records-filter-pill ${
                    statusFilter === item.id ? "records-filter-pill-active" : ""
                  }`}
                  onClick={() => setStatusFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="history-filters-right">
              <div className="history-date-filter-wrap">
                <input
                  type="date"
                  className="form-input history-date-input"
                  aria-label="Filtrar por data específica"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                {dateFilter && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setDateFilter("")}
                  >
                    Limpar data
                  </button>
                )}
              </div>

              <label className="search-field doctor-schedule-search">
                <span className="search-symbol" aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="search"
                  aria-label="Buscar paciente ou especialidade"
                  placeholder="Buscar paciente, data ou especialidade..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
          </div>
        </header>

        {avisoExpirados && (
          <div className="doctor-expired-alert" role="alert">
            <div className="doctor-expired-alert-content">
              <span className="doctor-expired-alert-icon" aria-hidden="true">
                ⚠
              </span>
              <div>
                <strong>Consulta encerrada por prazo expirado</strong>
                <p>{avisoExpirados}</p>
              </div>
            </div>
            <button
              type="button"
              className="doctor-expired-alert-close"
              aria-label="Fechar aviso"
              onClick={() => setAvisoExpirados("")}
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <strong>Carregando registros da agenda...</strong>
          </div>
        ) : error ? (
          <div className="empty-state">
            <strong>Não foi possível carregar os registros</strong>
            <p>{error}</p>
            <Btn variant="secondary" onClick={loadAppointments}>
              Tentar novamente
            </Btn>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              {activeTab === "futuro" ? "📅" : "🕘"}
            </span>
            <strong>
              {activeTab === "futuro"
                ? "Nenhuma consulta futura encontrada"
                : "Nenhum registro no histórico para este filtro"}
            </strong>
            <p>
              {activeTab === "futuro"
                ? "Não há pacientes agendados para datas futuras com os filtros atuais."
                : "Não foram encontradas consultas de datas passadas para os filtros selecionados."}
            </p>
            {(query || dateFilter || statusFilter !== "Todos") && (
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setDateFilter("");
                  setStatusFilter("Todos");
                }}
              >
                Limpar filtros
              </Btn>
            )}
          </div>
        ) : (
          <div className="history-date-groups-stack">
            {groupedByDate.map((group) => (
              <section key={group.dateIso} className="history-date-group">
                <header className="history-date-group-header">
                  <div className="history-date-group-title">
                    <span className="history-date-pill">{group.dateShort}</span>
                    <strong>{group.dateHeading}</strong>
                  </div>
                  <span className="records-count-badge">
                    {group.items.length} consulta(s)
                  </span>
                </header>

                <div className="doctor-patient-stack">
                  {group.items.map((appointment) => {
                    const { statusInfo, pacienteInfo, isTeleconsulta } =
                      appointment;
                    const isPending =
                      statusInfo.key === "confirmed" ||
                      statusInfo.key === "waiting";
                    const isCompleted = statusInfo.key === "completed";
                    const isCancelled =
                      statusInfo.key === "cancelled" ||
                      statusInfo.key === "noshow";

                    return (
                      <article
                        key={appointment.id}
                        className={`doctor-patient-card doctor-patient-card-${statusInfo.key}`}
                      >
                        <div className="doctor-patient-time-box">
                          <strong className="doctor-patient-hour">
                            {formatTime(appointment.data_hora)}
                          </strong>
                          <span className="doctor-patient-duration">
                            {appointment.duracao_minutos} min
                          </span>
                          <small className="doctor-patient-date">
                            {formatDateShort(appointment.data_hora)}
                          </small>
                        </div>

                        <div className="doctor-patient-main">
                          <div
                            className="patient-avatar doctor-uniform-avatar"
                            aria-hidden="true"
                          >
                            {pacienteInfo.iniciais}
                          </div>

                          <div className="doctor-patient-details">
                            <div className="doctor-patient-top-row">
                              <h3 className="doctor-patient-name">
                                {pacienteInfo.nome}
                              </h3>
                              <span
                                className={`status-pill status-${statusInfo.key}`}
                              >
                                {statusInfo.label}
                              </span>
                            </div>

                            <div className="doctor-patient-badges">
                              <span className="patient-record-badge">
                                {pacienteInfo.especialidade}
                              </span>
                              <span className="patient-record-badge">
                                {pacienteInfo.modalidadeLabel}
                              </span>
                              {pacienteInfo.profissionalNome && (
                                <span className="patient-record-badge">
                                  Dr(a). {pacienteInfo.profissionalNome}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="doctor-patient-actions">
                          {/* AÇÕES PARA DATAS PASSADAS (HISTÓRICO) */}
                          {appointment.dataPassada && (
                            <>
                              {isCancelled && (
                                <button
                                  type="button"
                                  className="doctor-action-btn doctor-action-expired-lock"
                                  onClick={() =>
                                    handleTentativaRetomarPassado(appointment)
                                  }
                                  title="Consultas de datas passadas não podem ser retomadas"
                                >
                                  ⊘ Prazo encerrado
                                </button>
                              )}

                              <Btn
                                variant={isCompleted ? "outline" : "secondary"}
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/prontuario/${appointment.paciente_id}`
                                  )
                                }
                              >
                                {isCompleted
                                  ? "Abrir prontuário →"
                                  : "Ver prontuário"}
                              </Btn>
                            </>
                          )}

                          {/* AÇÕES PARA DATAS FUTURAS */}
                          {appointment.dataFutura && (
                            <>
                              {isPending && (
                                <>
                                  {isTeleconsulta &&
                                    appointment.link_teleconsulta && (
                                      <a
                                        href={appointment.link_teleconsulta}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="doctor-action-btn"
                                      >
                                        📹 Sala virtual
                                      </a>
                                    )}

                                  <Btn
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/prontuario/${appointment.paciente_id}`
                                      )
                                    }
                                  >
                                    Ver prontuário
                                  </Btn>

                                  <button
                                    type="button"
                                    className="doctor-action-btn doctor-action-cancel"
                                    disabled={busyActionId === appointment.id}
                                    onClick={() =>
                                      handleCancelarFuturo(appointment)
                                    }
                                  >
                                    ✕ Cancelar
                                  </button>
                                </>
                              )}

                              {isCancelled && (
                                <>
                                  <button
                                    type="button"
                                    className="doctor-action-btn doctor-action-resume"
                                    disabled={busyActionId === appointment.id}
                                    onClick={() =>
                                      handleRetomarFuturo(appointment)
                                    }
                                  >
                                    ↺ Retomar consulta
                                  </button>

                                  <button
                                    type="button"
                                    className="doctor-action-btn doctor-action-delete"
                                    disabled={busyActionId === appointment.id}
                                    onClick={() =>
                                      handleExcluirFuturo(appointment)
                                    }
                                  >
                                    ✕ Excluir
                                  </button>

                                  <Btn
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/prontuario/${appointment.paciente_id}`
                                      )
                                    }
                                  >
                                    Ver prontuário
                                  </Btn>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
