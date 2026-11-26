import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import {
  garantirSessaoValida,
  obterToken,
  removerToken,
} from "../utils/auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function obterIniciais(nome = "") {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^A-Za-zÀ-ÿ]/g, ""))
    .filter(Boolean);
  if (partes.length === 0) return "PC";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

const audiogramGridX = [56, 118, 180, 242, 304, 366, 428];
const audiogramGridY = [32, 72, 112, 152, 192, 232];

const frequencies = ["250", "500", "1k", "2k", "3k", "4k", "8k"];

const sampleDocuments = [
  {
    title: "Laudo de avaliação inicial",
    description: "Anexo clínico registrado",
    type: "PDF",
  },
];

const patientSamples = {
  "1": {
    name: "Ana Beatriz Lima",
    initials: "AL",
    specialty: "Otorrinolaringologia",
    modality: "Presencial",
  },
  "2": {
    name: "Pedro Henrique Costa",
    initials: "PC",
    specialty: "Fonoaudiologia",
    modality: "Teleconsulta",
  },
  "3": {
    name: "João Silva",
    initials: "JS",
    specialty: "Otorrinolaringologia",
    modality: "Teleconsulta",
  },
  "4": {
    name: "Mariana Oliveira",
    initials: "MO",
    specialty: "Fonoaudiologia",
    modality: "Presencial",
  },
};

function Audiogram() {
  return (
    <div className="audiogram-container">
      <div className="audiogram-legend">
        <span>
          <span className="legend-symbol legend-blue">×</span>
          Via aérea — ouvido direito
        </span>

        <span>
          <span className="legend-symbol legend-red">○</span>
          Via aérea — ouvido esquerdo
        </span>
      </div>

      <div className="audiogram-plot">
        <svg
          className="audiogram-svg"
          viewBox="0 0 490 270"
          role="img"
          aria-label="Audiograma ilustrativo com frequências e níveis auditivos fictícios"
        >
          {audiogramGridX.map((x) => (
            <line
              key={`x-${x}`}
              x1={x}
              y1="32"
              x2={x}
              y2="232"
              stroke="#dfe5ee"
              strokeWidth="1"
            />
          ))}

          {audiogramGridY.map((y) => (
            <line
              key={`y-${y}`}
              x1="56"
              y1={y}
              x2="428"
              y2={y}
              stroke="#dfe5ee"
              strokeWidth="1"
            />
          ))}

          {["0", "20", "40", "60", "80", "100"].map((value, index) => (
            <text
              key={value}
              x="42"
              y={audiogramGridY[index] + 4}
              textAnchor="end"
              fontSize="10"
              fill="#69768c"
            >
              {value}
            </text>
          ))}

          {frequencies.map((frequency, index) => (
            <text
              key={frequency}
              x={audiogramGridX[index]}
              y="251"
              textAnchor="middle"
              fontSize="10"
              fill="#69768c"
            >
              {frequency}
            </text>
          ))}

          <text
            x="242"
            y="267"
            textAnchor="middle"
            fontSize="10"
            fill="#69768c"
          >
            Frequência (Hz)
          </text>

          <text
            x="12"
            y="15"
            fontSize="10"
            fill="#69768c"
          >
            dB HL
          </text>

          <polyline
            points="56,45 118,52 180,72 242,92 304,112 366,132 428,152"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
          />

          <polyline
            points="56,52 118,72 180,82 242,102 304,122 366,142 428,162"
            fill="none"
            stroke="#db5966"
            strokeWidth="2"
          />

          {[
            [56, 45],
            [118, 52],
            [180, 72],
            [242, 92],
            [304, 112],
            [366, 132],
            [428, 152],
          ].map(([x, y]) => (
            <g key={`right-${x}`} stroke="#2563eb" strokeWidth="2.5">
              <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
              <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} />
            </g>
          ))}

          {[
            [56, 52],
            [118, 72],
            [180, 82],
            [242, 102],
            [304, 122],
            [366, 142],
            [428, 162],
          ].map(([x, y]) => (
            <circle
              key={`left-${x}`}
              cx={x}
              cy={y}
              r="5"
              fill="white"
              stroke="#db5966"
              strokeWidth="2.5"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function Prontuario() {
  const { id } = useParams();
  const location = useLocation();
  const statePatient = location.state?.patient || null;

  const fallbackSample = patientSamples[id] ?? {
    name: "Paciente em atendimento",
    initials: "PC",
    specialty: "Fonoaudiologia",
    modality: "Presencial",
    code: UUID_REGEX.test(String(id || ""))
      ? `PRT-${String(id).slice(0, 6).toUpperCase()}`
      : `PRT-00${id}`,
    statusKey: "confirmed",
    statusLabel: "Em acompanhamento",
  };

  const [fetchedPatient, setFetchedPatient] = useState(null);

  useEffect(() => {
    let ativo = true;
    async function carregarPacienteReal() {
      if (statePatient || !UUID_REGEX.test(String(id || ""))) return;
      try {
        let token = obterToken() || (await garantirSessaoValida());
        let resp = await fetch(`${API_URL}/api/v1/pacientes/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.status === 401) {
          removerToken();
          token = await garantirSessaoValida();
          if (token) {
            resp = await fetch(`${API_URL}/api/v1/pacientes/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        }
        if (!ativo || !resp.ok) return;
        const data = await resp.json();
        const nome = String(data?.nome_completo || data?.nome || "").trim();
        if (nome) {
          setFetchedPatient({
            name: nome,
            initials: obterIniciais(nome),
            specialty: "Fonoaudiologia",
            modality: "Presencial",
            code: `PRT-${String(id).slice(0, 6).toUpperCase()}`,
            statusKey: "confirmed",
            statusLabel: "Em acompanhamento",
          });
        }
      } catch {
        /* mantém fallback */
      }
    }
    carregarPacienteReal();
    return () => {
      ativo = false;
    };
  }, [id, statePatient]);

  const patient = statePatient || fetchedPatient || fallbackSample;
  const recordCode =
    patient.code ||
    (UUID_REGEX.test(String(id || ""))
      ? `PRT-${String(id).slice(0, 6).toUpperCase()}`
      : `PRT-00${id}`);

  const [activeSection, setActiveSection] = useState("anamnese");
  const [anamnese, setAnamnese] = useState("");
  const [evolucao, setEvolucao] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const { showToast } = useToast();

  function simulateTranscription() {
    setTranscribing(true);

    const sampleText =
      "Paciente relata acompanhamento auditivo e adesão aos exercícios " +
      "terapêuticos. Realizar avaliação clínica complementar na próxima consulta.";

    setAnamnese((current) =>
      current ? `${current}\n\n${sampleText}` : sampleText
    );

    setTranscribing(false);
    showToast("Transcrição clínica inserida no prontuário.");
  }

  function handleSave() {
    showToast("Prontuário salvo com sucesso.");
  }

  function handleUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploadedFile(file.name);
    showToast(`Documento "${file.name}" anexado ao atendimento.`);
  }

  return (
    <div className="page-stack">
      <section className="patient-overview">
        <div className="patient-overview-main">
          <div className="patient-large-avatar doctor-uniform-avatar">
            {patient.initials}
          </div>

          <div>
            <div className="patient-name-row">
              <h3>{patient.name}</h3>
            </div>

            <p>Prontuário #{recordCode} · Cadastro ativo</p>

            <div className="patient-metadata">
              <span>{patient.specialty}</span>
              <span>{patient.modality}</span>
            </div>
          </div>
        </div>

        <div className="overview-actions">
          <span className="record-status">
            <span className="status-indicator" />
            Atendimento aberto
          </span>
          <Btn
            variant="secondary"
            size="sm"
            onClick={() => window.history.back()}
          >
            ← Voltar
          </Btn>
        </div>
      </section>

      <div className="record-layout">
        <div className="record-primary">
          <Card title="Registro clínico">
            <div className="record-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "anamnese"}
                className={`record-tab ${
                  activeSection === "anamnese" ? "record-tab-active" : ""
                }`}
                onClick={() => setActiveSection("anamnese")}
              >
                Anamnese
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "evolucao"}
                className={`record-tab ${
                  activeSection === "evolucao" ? "record-tab-active" : ""
                }`}
                onClick={() => setActiveSection("evolucao")}
              >
                Evolução
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSection === "documentos"}
                className={`record-tab ${
                  activeSection === "documentos" ? "record-tab-active" : ""
                }`}
                onClick={() => setActiveSection("documentos")}
              >
                Documentos
              </button>
            </div>

            {activeSection === "anamnese" && (
              <div className="record-section">
                <label className="form-label" htmlFor="anamnese">
                  Relato e histórico do paciente
                </label>

                <textarea
                  id="anamnese"
                  className="form-input form-textarea"
                  rows={8}
                  placeholder="Registre aqui a queixa principal, o histórico e as informações relevantes da consulta..."
                  value={anamnese}
                  onChange={(event) => setAnamnese(event.target.value)}
                />

                <div className="record-editor-footer">
                  <span>{anamnese.length} caracteres</span>

                  <Btn
                    variant="outline"
                    onClick={simulateTranscription}
                    disabled={transcribing}
                  >
                    {transcribing
                      ? "Processando..."
                      : "✧ Transcrição clínica por IA"}
                  </Btn>
                </div>
              </div>
            )}

            {activeSection === "evolucao" && (
              <div className="record-section">
                <label className="form-label" htmlFor="evolucao">
                  Evolução clínica
                </label>

                <textarea
                  id="evolucao"
                  className="form-input form-textarea"
                  rows={8}
                  placeholder="Registre observações, condutas e o acompanhamento clínico..."
                  value={evolucao}
                  onChange={(event) => setEvolucao(event.target.value)}
                />
              </div>
            )}

            {activeSection === "documentos" && (
              <div className="record-section">
                <h3 className="subsection-title">Documentos do atendimento</h3>

                <label className="upload-zone">
                  <span className="upload-icon">↑</span>
                  <strong>Anexar documento ou exame</strong>
                  <span>PDF, imagem ou arquivo de áudio/vídeo</span>

                  <input
                    type="file"
                    onChange={handleUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.mp3,.mp4,.wav"
                  />
                </label>

                {uploadedFile && (
                  <div className="uploaded-file">
                    <span className="file-icon">▤</span>
                    <span>
                      <strong>{uploadedFile}</strong>
                      <small>Pronto para envio</small>
                    </span>
                  </div>
                )}

                <div className="document-list">
                  {sampleDocuments.map((document) => (
                    <div className="document-row" key={document.title}>
                      <span className="file-icon">▤</span>

                      <div>
                        <strong>{document.title}</strong>
                        <small>{document.description}</small>
                      </div>

                      <span className="file-type">{document.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card-footer-actions">
              <span className="save-caption">Registro em edição</span>

              <Btn onClick={handleSave}>Salvar prontuário</Btn>
            </div>
          </Card>

          <Card
            title="Audiometria tonal"
            description="Limiar auditivo por frequência (dB HL)"
          >
            <Audiogram />
          </Card>

          <Card
            title="Timpanometria"
            description="Curvas de imitanciometria acústica"
          >
            <div className="coming-soon-panel">
              <span className="coming-soon-icon">⌁</span>

              <div>
                <strong>Nenhum exame timpanométrico anexado</strong>
                <p>
                  Importe ou registre os parâmetros do exame para visualizar a
                  curva de complacência.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="record-secondary">
          <Card title="Resumo do atendimento">
            <div className="detail-list">
              <div className="detail-row">
                <span>Paciente</span>
                <strong>{patient.name}</strong>
              </div>

              <div className="detail-row">
                <span>Especialidade</span>
                <strong>{patient.specialty}</strong>
              </div>

              <div className="detail-row">
                <span>Modalidade</span>
                <strong>{patient.modality}</strong>
              </div>

              <div className="detail-row">
                <span>Prontuário</span>
                <strong>#{recordCode}</strong>
              </div>
            </div>
          </Card>

          <Card
            title="Multimídia clínica"
            description="Comparativo de registros vocais"
          >
            <div className="media-comparison">
              <div className="media-item">
                <div className="media-thumbnail media-before">
                  <span>01</span>
                </div>

                <div className="media-information">
                  <strong>Pré-intervenção</strong>
                  <small>Sem amostra anexada</small>
                </div>

                <button
                  type="button"
                  className="media-play-button"
                  aria-label="Consultar áudio anterior"
                  onClick={() =>
                    showToast("Nenhum áudio anterior foi associado ao paciente.")
                  }
                >
                  ▶
                </button>
              </div>

              <div className="media-item">
                <div className="media-thumbnail media-after">
                  <span>02</span>
                </div>

                <div className="media-information">
                  <strong>Pós-intervenção</strong>
                  <small>Sem amostra anexada</small>
                </div>

                <button
                  type="button"
                  className="media-play-button"
                  aria-label="Consultar áudio posterior"
                  onClick={() =>
                    showToast("Nenhum áudio posterior foi associado ao paciente.")
                  }
                >
                  ▶
                </button>
              </div>
            </div>
          </Card>

          <Card title="Roteiro de atendimento">
            <div className="next-steps-list">
              <div>
                <span className="step-marker">1</span>
                <span>
                  <strong>Registrar avaliação</strong>
                  <small>Preencher queixa e histórico na anamnese</small>
                </span>
              </div>

              <div>
                <span className="step-marker">2</span>
                <span>
                  <strong>Documentar conduta</strong>
                  <small>Detalhar evolução e plano terapêutico</small>
                </span>
              </div>

              <div>
                <span className="step-marker">3</span>
                <span>
                  <strong>Concluir registro</strong>
                  <small>Salvar prontuário e anexos do atendimento</small>
                </span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}