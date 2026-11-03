import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { listarReceitas, obterUrlDocumento } from "../services/documentos.js";
import { obterPacienteId } from "../utils/auth.js";
import { formatarData, formatarTamanho } from "../utils/formatar.js";

function rotuloDoTipo(contentType) {
  if (contentType === "application/pdf") return "PDF";
  return "IMG";
}

export default function Receitas() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const pacienteId = obterPacienteId();

  const [receitas, setReceitas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [abrindoId, setAbrindoId] = useState(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (pacienteId === null) {
      setErro("Não foi possível identificar o paciente. Entre novamente.");
      setCarregando(false);
      return undefined;
    }

    const controlador = new AbortController();
    setCarregando(true);
    setErro("");

    listarReceitas(pacienteId, { signal: controlador.signal })
      .then(setReceitas)
      .catch((e) => {
        if (e.name !== "AbortError") setErro(e.message);
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregando(false);
      });

    return () => controlador.abort();
  }, [pacienteId, tentativa]);

  async function abrirReceita(receita) {
    // A aba é aberta já no clique: depois de um await o navegador bloquearia o pop-up.
    const aba = window.open("", "_blank");
    setAbrindoId(receita.id);

    try {
      const { url } = await obterUrlDocumento(receita.id);

      if (!aba) {
        showToast("O navegador bloqueou a nova aba. Permita pop-ups para abrir a receita.");
        return;
      }

      aba.opener = null;
      aba.location.href = url;
    } catch (e) {
      if (aba) aba.close();
      showToast(e.message);
    } finally {
      setAbrindoId(null);
    }
  }

  return (
    <div className="patient-page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">SEU ESPAÇO DE CUIDADO</span>
          <h2 className="page-title">Minhas receitas</h2>
          <p className="page-subtitle">
            Receitas liberadas pelo seu profissional de saúde.
          </p>
        </div>

        <Btn variant="secondary" onClick={() => navigate("/portal")}>
          ← Voltar
        </Btn>
      </section>

      <Card
        title="Receitas disponíveis"
        description="Os links de abertura são temporários, por segurança."
      >
        {carregando && (
          <p className="receitas-feedback" role="status">
            Carregando suas receitas...
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

        {!carregando && !erro && receitas.length === 0 && (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">▤</span>
            <strong>Nenhuma receita disponível</strong>
            <p>
              Quando seu profissional liberar uma receita, ela aparecerá aqui.
            </p>
          </div>
        )}

        {!carregando && !erro && receitas.length > 0 && (
          <div className="receitas-list">
            {receitas.map((receita) => (
              <div className="document-row" key={receita.id}>
                <span className="file-icon" aria-hidden="true">▤</span>

                <div>
                  <strong>{receita.titulo}</strong>
                  <small>
                    Liberada em {formatarData(receita.liberado_em ?? receita.criado_em)} ·{" "}
                    {formatarTamanho(receita.tamanho_bytes)}
                  </small>
                </div>

                <span className="file-type">{rotuloDoTipo(receita.content_type)}</span>

                <Btn
                  variant="outline"
                  size="small"
                  disabled={abrindoId === receita.id}
                  onClick={() => abrirReceita(receita)}
                >
                  {abrindoId === receita.id ? "Abrindo..." : "Abrir"}
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
