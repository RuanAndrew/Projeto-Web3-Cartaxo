
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const filters = [
  "Todas",
  "Confirmadas",
  "Aguardando",
  "Concluídas",
  "Canceladas",
];

const initialFormData = {
  paciente_id: "",
  profissional_id: "",
  data: "",
  horario: "",
  duracao_minutos: "30",
};

function initialsFromName(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "Data não informada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
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

function getAppointmentStatus(status) {
  const statuses = {
    agendado: {
      label: "Confirmada",
      key: "confirmed",
    },
    cancelado: {
      label: "Cancelada",
      key: "cancelled",
    },
    concluido: {
      label: "Concluída",
      key: "completed",
    },
    concluída: {
      label: "Concluída",
      key: "completed",
    },
    aguardando: {
      label: "Aguardando",
      key: "waiting",
    },
  };

  return (
    statuses[String(status || "").toLowerCase()] || {
      label: status || "Não informado",
      key: "waiting",
    }
  );
}

function StatCard({ label, value, description, symbol, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span
          className={`stat-icon stat-icon-${tone}`}
          aria-hidden="true"
        >
          {symbol}
        </span>
      </div>

      <strong className="stat-value">{value}</strong>
      <span className="stat-description">{description}</span>
    </div>
  );
}

export default function Agenda() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  async function loadAppointments() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/agendamentos`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar os agendamentos.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("A API retornou um formato inesperado.");
      }

      setAppointments(data);
    } catch (err) {
      setError(
        err.message ||
          "Erro ao carregar os agendamentos. Verifique o backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const visibleAppointments = useMemo(() => {
    const search = query.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const status = getAppointmentStatus(appointment.status);

      const patient = `Paciente ${appointment.paciente_id ?? ""}`;
      const professional = `Profissional ${appointment.profissional_id ?? ""}`;

      const matchesSearch =
        !search ||
        patient.toLowerCase().includes(search) ||
        professional.toLowerCase().includes(search) ||
        String(appointment.id ?? "").includes(search) ||
        status.label.toLowerCase().includes(search);

      const matchesFilter =
        filter === "Todas" ||
        (filter === "Confirmadas" && status.key === "confirmed") ||
        (filter === "Aguardando" && status.key === "waiting") ||
        (filter === "Concluídas" && status.key === "completed") ||
        (filter === "Canceladas" && status.key === "cancelled");

      return matchesSearch && matchesFilter;
    });
  }, [appointments, query, filter]);

  const stats = useMemo(() => {
    const countByStatus = (key) =>
      appointments.filter(
        (appointment) =>
          getAppointmentStatus(appointment.status).key === key
      ).length;

    return {
      total: appointments.length,
      completed: countByStatus("completed"),
      waiting: countByStatus("waiting"),
      cancelled: countByStatus("cancelled"),
    };
  }, [appointments]);

  function handleNewAppointment() {
    setFormData({ ...initialFormData });
    setShowForm(true);
    setError("");
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmitAppointment(event) {
    event.preventDefault();

    if (saving) return;

    const pacienteId = Number(formData.paciente_id);
    const profissionalId = Number(formData.profissional_id);
    const duracao = Number(formData.duracao_minutos);

    if (
      !Number.isInteger(pacienteId) ||
      pacienteId <= 0 ||
      !Number.isInteger(profissionalId) ||
      profissionalId <= 0
    ) {
      showToast("Informe IDs válidos para paciente e profissional.");
      return;
    }

    if (!formData.data || !formData.horario) {
      showToast("Preencha a data e o horário da consulta.");
      return;
    }

    const dataHora = new Date(
      `${formData.data}T${formData.horario}:00`
    );

    if (Number.isNaN(dataHora.getTime())) {
      showToast("Informe uma data e um horário válidos.");
      return;
    }

    if (!Number.isInteger(duracao) || duracao <= 0) {
      showToast("Informe uma duração válida.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/agendamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paciente_id: pacienteId,
          profissional_id: profissionalId,
          data_hora: dataHora.toISOString(),
          duracao_minutos: duracao,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail
                  .map((item) => item.msg)
                  .filter(Boolean)
                  .join(" ")
              : "";

        throw new Error(
          detail || "Não foi possível cadastrar o agendamento."
        );
      }

      setAppointments((current) => [...current, data]);
      setShowForm(false);
      setFormData({ ...initialFormData });

      showToast("Agendamento cadastrado com sucesso!");
    } catch (err) {
      showToast(
        err.message || "Erro ao cadastrar o agendamento."
      );
    } finally {
      setSaving(false);
    }
  }

  function openRecord(id) {
    navigate(`/prontuario/${id}`);
  }

  function handleVideoAppointment() {
    showToast(
      "A integração de teleconsulta ainda não está configurada."
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>

          <h2 className="page-title">Sua agenda clínica</h2>

          <p className="page-subtitle">
            Organize seus atendimentos e acompanhe a rotina da clínica.
          </p>
        </div>

        <Btn onClick={handleNewAppointment}>
          <span aria-hidden="true">＋</span> Nova consulta
        </Btn>
      </section>

      {showForm && (
        <Card
          title="Novo agendamento"
          description="Preencha os dados da consulta."
        >
          <form onSubmit={handleSubmitAppointment}>
            <div className="form-grid">
              <label className="form-field">
                <span>ID do paciente</span>
                <input
                  type="number"
                  name="paciente_id"
                  min="1"
                  value={formData.paciente_id}
                  onChange={handleFormChange}
                  placeholder="Ex.: 1"
                  required
                />
              </label>

              <label className="form-field">
                <span>ID do profissional</span>
                <input
                  type="number"
                  name="profissional_id"
                  min="1"
                  value={formData.profissional_id}
                  onChange={handleFormChange}
                  placeholder="Ex.: 1"
                  required
                />
              </label>

              <label className="form-field">
                <span>Data</span>
                <input
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleFormChange}
                  required
                />
              </label>

              <label className="form-field">
                <span>Horário</span>
                <input
                  type="time"
                  name="horario"
                  value={formData.horario}
                  onChange={handleFormChange}
                  required
                />
              </label>

              <label className="form-field">
                <span>Duração</span>
                <select
                  name="duracao_minutos"
                  value={formData.duracao_minutos}
                  onChange={handleFormChange}
                >
                  <option value="15">15 minutos</option>
                  <option value="30">30 minutos</option>
                  <option value="40">40 minutos</option>
                  <option value="45">45 minutos</option>
                  <option value="50">50 minutos</option>
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <Btn
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Btn>

              <Btn type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar agendamento"}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      <section className="stat-grid" aria-label="Resumo da agenda">
        <StatCard
          label="Total de consultas"
          value={String(stats.total).padStart(2, "0")}
          description="Agendamentos cadastrados"
          symbol="◷"
          tone="blue"
        />

        <StatCard
          label="Concluídas"
          value={String(stats.completed).padStart(2, "0")}
          description="Atendimentos finalizados"
          symbol="✓"
          tone="green"
        />

        <StatCard
          label="Aguardando"
          value={String(stats.waiting).padStart(2, "0")}
          description="Status não identificado"
          symbol="◉"
          tone="orange"
        />

        <StatCard
          label="Canceladas"
          value={String(stats.cancelled).padStart(2, "0")}
          description="Agendamentos cancelados"
          symbol="⌘"
          tone="purple"
        />
      </section>

      <div className="page-toolbar">
        <div>
          <h3 className="section-title">Atendimentos</h3>
          <p className="section-description">
            Horários e informações dos pacientes.
          </p>
        </div>

        <label className="search-field">
          <span className="search-symbol" aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            aria-label="Buscar paciente ou profissional"
            placeholder="Buscar paciente..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="appointment-filters" aria-label="Filtrar consultas">
        {filters.map((item) => (
          <button
            type="button"
            key={item}
            className={`filter-button ${
              filter === item ? "filter-button-active" : ""
            }`}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}

        <span className="filter-count">
          {visibleAppointments.length} atendimento(s)
        </span>
      </div>

      <div className="agenda-layout">
        <Card
          className="appointments-card"
          title="Programação do dia"
          description="Agendamentos carregados do sistema"
          action={<span className="date-pill">Agenda integrada</span>}
        >
          {loading ? (
            <div className="empty-state">
              <strong>Carregando agendamentos...</strong>
            </div>
          ) : error ? (
            <div className="empty-state">
              <strong>Não foi possível carregar a agenda</strong>
              <p>{error}</p>

              <Btn variant="secondary" onClick={loadAppointments}>
                Tentar novamente
              </Btn>
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">⌕</span>
              <strong>Nenhum atendimento encontrado</strong>
              <p>
                Tente outro termo ou selecione um filtro diferente.
              </p>

              <Btn
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("Todas");
                }}
              >
                Limpar filtros
              </Btn>
            </div>
          ) : (
            <div className="appointment-list">
              {visibleAppointments.map((appointment, index) => {
                const status = getAppointmentStatus(appointment.status);
                const patient = `Paciente ${appointment.paciente_id}`;
                const colorClasses = [
                  "lavender",
                  "mint",
                  "peach",
                  "blue",
                ];

                return (
                  <article
                    className="appointment-row"
                    key={appointment.id}
                  >
                    <div className="appointment-time">
                      <strong>{formatTime(appointment.data_hora)}</strong>
                      <span>{appointment.duracao_minutos} min</span>
                    </div>

                    <div
                      className={`patient-avatar avatar-${
                        colorClasses[index % colorClasses.length]
                      }`}
                      aria-hidden="true"
                    >
                      {initialsFromName(patient)}
                    </div>

                    <div className="appointment-info">
                      <div className="appointment-patient-line">
                        <h4>{patient}</h4>

                        <span
                          className={`status-pill status-${status.key}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p>
                        Profissional {appointment.profissional_id}
                      </p>

                      <span className="appointment-type">
                        <span aria-hidden="true">⌖</span>
                        Consulta · {formatDateTime(appointment.data_hora)}
                      </span>
                    </div>

                    <div className="appointment-actions">
                      {status.key === "confirmed" && (
                        <Btn
                          variant="outline"
                          size="small"
                          onClick={handleVideoAppointment}
                        >
                          Teleconsulta
                        </Btn>
                      )}

                      <Btn
                        variant={
                          status.key === "completed"
                            ? "secondary"
                            : "primary"
                        }
                        size="small"
                        onClick={() =>
                          openRecord(appointment.paciente_id)
                        }
                      >
                        {status.key === "completed"
                          ? "Ver prontuário"
                          : "Atender"}
                      </Btn>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>

        <aside className="agenda-aside">
          <Card
            title="Resumo da rotina"
            description="Distribuição dos agendamentos cadastrados"
          >
            <div className="schedule-summary">
              <div className="schedule-summary-row">
                <span className="schedule-dot dot-blue" />
                <span>Agendadas</span>
                <strong>
                  {appointments.filter(
                    (item) => item.status === "agendado"
                  ).length.toString().padStart(2, "0")}
                </strong>
              </div>

              <div className="schedule-summary-row">
                <span className="schedule-dot dot-purple" />
                <span>Canceladas</span>
                <strong>
                  {stats.cancelled.toString().padStart(2, "0")}
                </strong>
              </div>

              <div className="schedule-summary-row">
                <span className="schedule-dot dot-green" />
                <span>Concluídas</span>
                <strong>
                  {stats.completed.toString().padStart(2, "0")}
                </strong>
              </div>
            </div>

            <div className="schedule-note">
              <span aria-hidden="true">ⓘ</span>
              <p>
                Os dados são carregados do serviço de agendamentos.
                Os nomes e as especialidades dependem da integração
                com os cadastros de pacientes e profissionais.
              </p>
            </div>
          </Card>

          <Card title="Acesso rápido">
            <div className="quick-action-list">
              <button
                type="button"
                className="quick-action"
                onClick={() => {
                  const firstAppointment = appointments[0];

                  if (firstAppointment) {
                    openRecord(firstAppointment.paciente_id);
                  } else {
                    showToast("Não há pacientes na agenda.");
                  }
                }}
              >
                <span className="quick-action-icon">▤</span>
                <span>
                  <strong>Prontuário clínico</strong>
                  <small>Consultar paciente agendado</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="quick-action"
                onClick={handleNewAppointment}
              >
                <span className="quick-action-icon">＋</span>
                <span>
                  <strong>Novo agendamento</strong>
                  <small>Cadastrar uma consulta</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
