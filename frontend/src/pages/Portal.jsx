import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import {
  garantirSessaoValida,
  lerPayload,
  obterToken,
  removerToken,
} from "../utils/auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const MESES_CURTOS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

const initialExercises = [
  {
    id: 1,
    title: "Vibração de lábios",
    description: "3 séries de 10 repetições",
    duration: "5 min",
  },
  {
    id: 2,
    title: "Exercício de respiração",
    description: "2 séries de 8 repetições",
    duration: "4 min",
  },
  {
    id: 3,
    title: "Articulação guiada",
    description: "Praticar conforme orientação",
    duration: "6 min",
  },
];

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

function formatarHora(iso) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarDataCompleta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Portal() {
  const [completedExercises, setCompletedExercises] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const nomeUsuario = useMemo(() => {
    const token = obterToken();
    const payload = token ? lerPayload(token) : null;
    if (payload?.nome) return String(payload.nome).split(" ")[0];
    if (payload?.email) return String(payload.email).split("@")[0];
    return "Paciente";
  }, []);

  async function carregarConsultas() {
    setCarregandoAgenda(true);
    try {
      const resp = await fetchComSessao(`${API_URL}/agendamentos`);
      if (resp.ok) {
        const dados = await resp.json();
        setAgendamentos(Array.isArray(dados) ? dados : []);
      }
    } catch {
      /* mantém lista vazia se offline */
    } finally {
      setCarregandoAgenda(false);
    }
  }

  useEffect(() => {
    carregarConsultas();
  }, []);

  const proximasConsultas = useMemo(() => {
    return agendamentos.filter(
      (a) => a.status === "agendado" || a.status === "aguardando"
    );
  }, [agendamentos]);

  const proximaConsulta = proximasConsultas[0] || null;

  const infoDataProxima = useMemo(() => {
    if (!proximaConsulta?.data_hora) return null;
    const d = new Date(proximaConsulta.data_hora);
    if (Number.isNaN(d.getTime())) return null;
    return {
      mes: MESES_CURTOS[d.getMonth()],
      dia: String(d.getDate()).padStart(2, "0"),
      hora: formatarHora(proximaConsulta.data_hora),
      dataCompleta: formatarDataCompleta(proximaConsulta.data_hora),
    };
  }, [proximaConsulta]);

  async function handleCancelarConsulta(consulta) {
    if (cancelandoId === consulta.id) return;
    setCancelandoId(consulta.id);
    try {
      const resp = await fetchComSessao(
        `${API_URL}/agendamentos/${consulta.id}/cancelar`,
        { method: "PATCH" }
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível cancelar o agendamento."
        );
      }
      const atualizado = await resp.json();
      setAgendamentos((prev) =>
        prev.map((item) => (item.id === consulta.id ? atualizado : item))
      );
      showToast("Consulta cancelada com sucesso.");
    } catch (err) {
      showToast(err.message || "Erro ao cancelar consulta.");
    } finally {
      setCancelandoId(null);
    }
  }

  const completedCount = completedExercises.length;

  const progress = Math.round(
    (completedCount / initialExercises.length) * 100
  );

  function toggleExercise(id) {
    if (checkedIn) return;

    setCompletedExercises((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function handleCheckIn() {
    if (completedCount === 0) {
      showToast("Marque pelo menos um exercício realizado antes do check-in.");
      return;
    }

    setCheckedIn(true);
    showToast(
      "Check-in registrado nesta sessão demonstrativa. O progresso ainda não foi salvo no servidor."
    );
  }

  return (
    <div className="patient-page-stack">
      <section className="patient-welcome">
        <div>
          <span className="eyebrow">SEU ESPAÇO DE CUIDADO</span>

          <h2>
            Olá, {nomeUsuario} <span aria-hidden="true">👋</span>
          </h2>

          <p>
            Cada pequena prática conta. Acompanhe suas consultas e mantenha
            a regularidade do tratamento.
          </p>
        </div>

        <div className="patient-welcome-art" aria-hidden="true">
          <div className="welcome-art-circle">
            <span>♡</span>
          </div>
        </div>
      </section>

      <section className="patient-metric-grid">
        <div className="patient-metric-card streak-card">
          <div className="patient-metric-top">
            <span className="patient-metric-icon">✦</span>
            <span className="patient-metric-label">
              Ofensiva atual
            </span>
          </div>

          <div className="streak-value">
            12 <span>dias</span>
          </div>

          <p>Sequência ilustrativa de dias de prática.</p>

          <div className="streak-week">
            {["S", "T", "Q", "Q", "S", "S", "D"].map(
              (day, index) => (
                <div
                  key={`${day}-${index}`}
                  className={`streak-day ${
                    index < 5 ? "streak-day-complete" : ""
                  }`}
                >
                  <span>{day}</span>
                  <strong>{index < 5 ? "✓" : "·"}</strong>
                </div>
              )
            )}
          </div>
        </div>

        <div className="patient-metric-card">
          <div className="patient-metric-top">
            <span className="patient-metric-icon metric-icon-green">
              ✓
            </span>
            <span className="patient-metric-label">
              Exercícios realizados
            </span>
          </div>

          <div className="patient-metric-value">
            {completedCount}
            <span> / {initialExercises.length}</span>
          </div>

          <div
            className="progress-track"
            role="progressbar"
            aria-label="Progresso dos exercícios de hoje"
            aria-valuemin={0}
            aria-valuemax={initialExercises.length}
            aria-valuenow={completedCount}
          >
            <div
              className="progress-bar progress-green"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p>{progress}% da rotina concluída hoje.</p>
        </div>

        <div className="patient-metric-card">
          <div className="patient-metric-top">
            <span className="patient-metric-icon metric-icon-purple">
              ◷
            </span>
            <span className="patient-metric-label">
              Próxima consulta
            </span>
          </div>

          <div className="next-appointment-time">
            {carregandoAgenda
              ? "..."
              : infoDataProxima
                ? infoDataProxima.hora
                : "--:--"}
          </div>

          <strong className="next-appointment-date">
            {carregandoAgenda
              ? "Carregando agenda..."
              : infoDataProxima
                ? `${infoDataProxima.dataCompleta} · ${
                    proximaConsulta.modalidade === "teleconsulta"
                      ? "Teleconsulta"
                      : "Presencial"
                  }`
                : "Nenhuma consulta agendada"}
          </strong>

          <p>
            {proximasConsultas.length > 0
              ? `${proximasConsultas.length} agendamento(s) ativo(s).`
              : "Sem atendimentos futuros programados."}
          </p>
        </div>
      </section>

      <div className="patient-content-grid">
        <Card
          className="patient-exercises-card"
          title="Seus exercícios de hoje"
          description="Marque os exercícios conforme você os realiza."
          action={
            <span className="date-pill">
              {completedCount}/{initialExercises.length}
            </span>
          }
        >
          <div className="exercise-list">
            {initialExercises.map((exercise) => {
              const isCompleted = completedExercises.includes(exercise.id);

              return (
                <label
                  key={exercise.id}
                  className={`exercise-row ${
                    isCompleted ? "exercise-row-completed" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    disabled={checkedIn}
                    onChange={() => toggleExercise(exercise.id)}
                  />

                  <span className="exercise-check-visual">
                    {isCompleted ? "✓" : ""}
                  </span>

                  <span className="exercise-copy">
                    <strong>{exercise.title}</strong>
                    <small>{exercise.description}</small>
                  </span>

                  <span className="exercise-duration">
                    {exercise.duration}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="exercise-progress-summary">
            <div>
              <strong>Seu progresso diário</strong>
              <span>{progress}%</span>
            </div>

            <div className="progress-track">
              <div
                className="progress-bar progress-blue"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Btn
            block
            onClick={handleCheckIn}
            disabled={checkedIn}
          >
            {checkedIn ? "✓ Check-in desta sessão concluído" : "Registrar check-in diário"}
          </Btn>

          {checkedIn && (
            <p className="checkin-success" role="status">
              Você registrou sua prática neste protótipo. Seu progresso
              não está sendo sincronizado com uma conta real.
            </p>
          )}
        </Card>

        <div className="patient-side-stack">
          <Card
            title="Seu próximo atendimento"
            description={
              proximaConsulta
                ? "Dados sincronizados com o serviço de agendamento"
                : "Você não possui consultas pendentes no momento"
            }
          >
            {carregandoAgenda ? (
              <p>Carregando consultas...</p>
            ) : proximaConsulta && infoDataProxima ? (
              <>
                <div className="patient-appointment">
                  <div className="patient-appointment-date">
                    <span>{infoDataProxima.mes}</span>
                    <strong>{infoDataProxima.dia}</strong>
                  </div>

                  <div className="patient-appointment-info">
                    <strong>
                      {proximaConsulta.modalidade === "teleconsulta"
                        ? "Teleconsulta Online"
                        : "Consulta Presencial"}
                    </strong>
                    <span>
                      {infoDataProxima.hora} · {proximaConsulta.duracao_minutos} min
                    </span>
                    <span>Status: {proximaConsulta.status}</span>
                  </div>
                </div>

                {proximaConsulta.modalidade === "teleconsulta" && (
                  <div style={{ marginTop: "12px" }}>
                    {proximaConsulta.link_teleconsulta ? (
                      <a
                        href={proximaConsulta.link_teleconsulta}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-block"
                      >
                        📹 Entrar na Teleconsulta
                      </a>
                    ) : (
                      <p role="status">
                        A sala virtual ainda não foi disponibilizada pelo profissional.
                      </p>
                    )}
                  </div>
                )}

                <div className="appointment-divider" />

                <button
                  type="button"
                  className="patient-text-action"
                  disabled={cancelandoId === proximaConsulta.id}
                  onClick={() => handleCancelarConsulta(proximaConsulta)}
                >
                  {cancelandoId === proximaConsulta.id
                    ? "Cancelando..."
                    : "Cancelar consulta"}{" "}
                  <span aria-hidden="true">✕</span>
                </button>
              </>
            ) : (
              <p>Nenhum agendamento ativo encontrado para sua conta.</p>
            )}
          </Card>

          <Card title="Uma mensagem para você">
            <div className="encouragement">
              <span className="encouragement-icon">✦</span>

              <p>
                A regularidade importa mais do que a perfeição. Siga
                as orientações do seu profissional e respeite seu ritmo.
              </p>
            </div>
          </Card>

          <Card title="Acesso rápido">
            <div className="patient-shortcuts">
              <button
                type="button"
                onClick={() => carregarConsultas()}
              >
                <span>↻</span>
                <strong>Atualizar consultas</strong>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate("/portal/receitas")
                }
              >
                <span>＋</span>
                <strong>Minhas receitas</strong>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}