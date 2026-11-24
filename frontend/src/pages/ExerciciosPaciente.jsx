import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { obterToken } from "../utils/auth.js";

const EXERCICIOS_API =
  import.meta.env.VITE_EXERCICIOS_URL || "http://localhost:8000";

export default function ExerciciosPaciente() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [exercicios, setExercicios] = useState([]);
  const [concluidos, setConcluidos] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    setCarregando(true);
    setErro("");

    const token = obterToken();

    axios
      .get(`${EXERCICIOS_API}/exercicios`, {
        signal: controlador.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then(({ data }) => {
        setExercicios(Array.isArray(data) ? data : data.items || []);
      })
      .catch((e) => {
        if (!axios.isCancel(e)) {
          setErro(
            e.response?.data?.detail ||
              "Não foi possível carregar seus exercícios no momento."
          );
        }
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregando(false);
      });

    return () => controlador.abort();
  }, [tentativa]);

  function alternarConclusao(exercicio) {
    const novoStatus = !concluidos[exercicio.id];
    setConcluidos((prev) => ({ ...prev, [exercicio.id]: novoStatus }));

    if (novoStatus) {
      showToast(`Exercício "${exercicio.nome}" marcado como concluído!`);
    }
  }

  return (
    <div className="patient-page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">SEU ESPAÇO DE CUIDADO</span>
          <h2 className="page-title">Meus exercícios</h2>
          <p className="page-subtitle">
            Atividades e orientações descritas pelo seu profissional de saúde.
          </p>
        </div>

        <Btn variant="secondary" onClick={() => navigate("/portal")}>
          ← Voltar
        </Btn>
      </section>

      <Card
        title="Plano de exercícios"
        description="Siga atentamente as instruções de séries, repetições e postura."
      >
        {carregando && (
          <p className="receitas-feedback" role="status">
            Carregando seus exercícios...
          </p>
        )}

        {!carregando && erro && (
          <div className="receitas-feedback" role="alert">
            <p>{erro}</p>
            <Btn variant="secondary" onClick={() => setTentativa((n) => n + 1)}>
              Tentar novamente
            </Btn>
          </div>
        )}

        {!carregando && !erro && exercicios.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">
              ▤
            </span>
            <strong>Nenhum exercício prescrito</strong>
            <p>
              Quando seu médico adicionar exercícios ao seu tratamento, eles
              aparecerão aqui.
            </p>
          </div>
        )}

        {!carregando && !erro && exercicios.length > 0 && (
          <div className="patient-records-grid">
            {exercicios.map((ex) => {
              const finalizado = Boolean(concluidos[ex.id]);

              return (
                <article
                  className="patient-record-card"
                  key={ex.id}
                  style={{
                    opacity: finalizado ? 0.78 : 1,
                    transition: "opacity 0.2s ease",
                  }}
                >
                  <div className="patient-record-card-main">
                    <div className="patient-record-info">
                      <div className="patient-record-name-line">
                        <strong>{ex.nome}</strong>
                        <span className="patient-record-badge patient-record-badge-specialty">
                          {ex.categoria}
                        </span>
                        {finalizado && (
                          <span className="status-pill status-confirmed">
                            Concluído hoje
                          </span>
                        )}
                      </div>

                      <p
                        style={{
                          margin: "0.45rem 0",
                          fontSize: "0.92rem",
                          color: "var(--text-secondary, #4b5563)",
                        }}
                      >
                        {ex.descricao}
                      </p>

                      <div
                        style={{
                          background: "var(--surface-subtle, #f8fafc)",
                          padding: "0.65rem 0.85rem",
                          borderRadius: "8px",
                          marginTop: "0.5rem",
                          fontSize: "0.88rem",
                        }}
                      >
                        <strong>Como fazer:</strong> {ex.instrucoes}
                      </div>
                    </div>
                  </div>

                  <div
                    className="patient-record-card-action"
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {ex.url_midia && (
                      <a
                        href={ex.url_midia}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        Ver demonstração ↗
                      </a>
                    )}

                    <Btn
                      variant={finalizado ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => alternarConclusao(ex)}
                    >
                      {finalizado ? "✓ Concluído" : "Marcar como feito"}
                    </Btn>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}