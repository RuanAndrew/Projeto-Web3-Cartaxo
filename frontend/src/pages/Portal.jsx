import { useState } from "react";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";

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

export default function Portal() {
  const [completedExercises, setCompletedExercises] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const { showToast } = useToast();

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
            Olá, João <span aria-hidden="true">👋</span>
          </h2>

          <p>
            Cada pequena prática conta. Acompanhe sua evolução e mantenha
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

          <div className="next-appointment-time">14:00</div>

          <strong className="next-appointment-date">Próximo atendimento</strong>

          <p>Horário fictício para demonstração.</p>
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
            description="Informações da consulta demonstrativa"
          >
            <div className="patient-appointment">
              <div className="patient-appointment-date">
                <span>OUT</span>
                <strong>20</strong>
              </div>

              <div className="patient-appointment-info">
                <strong>Acompanhamento clínico</strong>
                <span>14:00 · Horário ilustrativo</span>
                <span>Profissional de saúde</span>
              </div>
            </div>

            <div className="appointment-divider" />

            <button
              type="button"
              className="patient-text-action"
              onClick={() =>
                showToast("O reagendamento será integrado ao serviço de agenda.")
              }
            >
              Solicitar reagendamento <span aria-hidden="true">→</span>
            </button>
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
                onClick={() =>
                  showToast("O histórico clínico será conectado ao backend.")
                }
              >
                <span>▤</span>
                <strong>Meu histórico</strong>
                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  showToast("A área de receitas será integrada ao backend.")
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