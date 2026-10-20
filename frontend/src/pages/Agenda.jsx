import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";

const appointments = [
  {
    id: "1",
    time: "08:30",
    duration: "40 min",
    patient: "Ana Beatriz Lima",
    initials: "AL",
    specialty: "Otorrinolaringologia",
    type: "Presencial",
    status: "Concluída",
    statusKey: "completed",
    color: "lavender",
  },
  {
    id: "2",
    time: "10:00",
    duration: "50 min",
    patient: "Pedro Henrique Costa",
    initials: "PC",
    specialty: "Fonoaudiologia",
    type: "Teleconsulta",
    status: "Confirmada",
    statusKey: "confirmed",
    color: "mint",
  },
  {
    id: "3",
    time: "14:00",
    duration: "40 min",
    patient: "João Silva",
    initials: "JS",
    specialty: "Otorrinolaringologia",
    type: "Teleconsulta",
    status: "Aguardando",
    statusKey: "waiting",
    color: "peach",
  },
  {
    id: "4",
    time: "15:30",
    duration: "30 min",
    patient: "Mariana Oliveira",
    initials: "MO",
    specialty: "Fonoaudiologia",
    type: "Presencial",
    status: "Confirmada",
    statusKey: "confirmed",
    color: "blue",
  },
];

const filters = [
  "Todas",
  "Confirmadas",
  "Aguardando",
  "Concluídas",
];

function StatCard({ label, value, description, symbol, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon stat-icon-${tone}`} aria-hidden="true">
          {symbol}
        </span>
      </div>

      <strong className="stat-value">{value}</strong>
      <span className="stat-description">{description}</span>
    </div>
  );
}

function initialsFromName(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Agenda() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todas");
  const { showToast } = useToast();

  const visibleAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const search = query.trim().toLowerCase();

      const matchesSearch =
        !search ||
        appointment.patient.toLowerCase().includes(search) ||
        appointment.specialty.toLowerCase().includes(search);

      const matchesFilter =
        filter === "Todas" ||
        (filter === "Confirmadas" &&
          appointment.status === "Confirmada") ||
        (filter === "Aguardando" &&
          appointment.status === "Aguardando") ||
        (filter === "Concluídas" &&
          appointment.status === "Concluída");

      return matchesSearch && matchesFilter;
    });
  }, [query, filter]);

  function handleNewAppointment() {
    showToast(
      "O formulário de agendamento será conectado ao serviço de agenda."
    );
  }

  function handleVideoAppointment(patient) {
    showToast(
      `A integração de teleconsulta de ${patient} ainda não está configurada.`
    );
  }

  function openRecord(id) {
    navigate(`/prontuario/${id}`);
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

      <section className="stat-grid" aria-label="Resumo da agenda">
        <StatCard
          label="Consultas do dia"
          value="08"
          description="Atendimentos previstos"
          symbol="◷"
          tone="blue"
        />

        <StatCard
          label="Concluídas"
          value="03"
          description="Atendimentos finalizados"
          symbol="✓"
          tone="green"
        />

        <StatCard
          label="Aguardando"
          value="02"
          description="Pacientes pendentes"
          symbol="◉"
          tone="orange"
        />

        <StatCard
          label="Teleconsultas"
          value="03"
          description="Atendimentos remotos"
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
            aria-label="Buscar paciente ou especialidade"
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
          description="Horários ilustrativos para demonstração"
          action={<span className="date-pill">Agenda demonstrativa</span>}
        >
          {visibleAppointments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">⌕</span>
              <strong>Nenhum atendimento encontrado</strong>
              <p>
                Tente outro nome ou selecione um filtro diferente.
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
              {visibleAppointments.map((appointment) => (
                <article
                  className="appointment-row"
                  key={appointment.id}
                >
                  <div className="appointment-time">
                    <strong>{appointment.time}</strong>
                    <span>{appointment.duration}</span>
                  </div>

                  <div
                    className={`patient-avatar avatar-${appointment.color}`}
                    aria-hidden="true"
                  >
                    {appointment.initials}
                  </div>

                  <div className="appointment-info">
                    <div className="appointment-patient-line">
                      <h4>{appointment.patient}</h4>

                      <span
                        className={`status-pill status-${appointment.statusKey}`}
                      >
                        {appointment.status}
                      </span>
                    </div>

                    <p>{appointment.specialty}</p>

                    <span className="appointment-type">
                      <span aria-hidden="true">
                        {appointment.type === "Teleconsulta"
                          ? "⌘"
                          : "⌖"}
                      </span>

                      {appointment.type}
                    </span>
                  </div>

                  <div className="appointment-actions">
                    {appointment.type === "Teleconsulta" && (
                      <Btn
                        variant="outline"
                        size="small"
                        onClick={() =>
                          handleVideoAppointment(appointment.patient)
                        }
                      >
                        Teleconsulta
                      </Btn>
                    )}

                    <Btn
                      variant={
                        appointment.status === "Concluída"
                          ? "secondary"
                          : "primary"
                      }
                      size="small"
                      onClick={() => openRecord(appointment.id)}
                    >
                      {appointment.status === "Concluída"
                        ? "Ver prontuário"
                        : "Atender"}
                    </Btn>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <aside className="agenda-aside">
          <Card
            title="Resumo da rotina"
            description="Distribuição ilustrativa dos atendimentos"
          >
            <div className="schedule-summary">
              <div className="schedule-summary-row">
                <span className="schedule-dot dot-blue" />
                <span>Presenciais</span>
                <strong>05</strong>
              </div>

              <div className="schedule-summary-row">
                <span className="schedule-dot dot-purple" />
                <span>Teleconsultas</span>
                <strong>03</strong>
              </div>

              <div className="schedule-summary-row">
                <span className="schedule-dot dot-green" />
                <span>Finalizadas</span>
                <strong>03</strong>
              </div>
            </div>

            <div className="schedule-note">
              <span aria-hidden="true">ⓘ</span>
              <p>
                Os indicadores são fictícios e serão calculados a partir
                dos dados reais da agenda após a integração com o backend.
              </p>
            </div>
          </Card>

          <Card title="Acesso rápido">
            <div className="quick-action-list">
              <button
                type="button"
                className="quick-action"
                onClick={() => openRecord("1")}
              >
                <span className="quick-action-icon">▤</span>
                <span>
                  <strong>Prontuário clínico</strong>
                  <small>Consultar registro demonstrativo</small>
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
                  <small>Fluxo a ser integrado</small>
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