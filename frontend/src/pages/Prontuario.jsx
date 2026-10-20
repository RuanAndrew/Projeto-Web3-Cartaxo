import { useState } from "react";
import { useParams } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";

const audiogramGridX = [56, 118, 180, 242, 304, 366, 428];
const audiogramGridY = [32, 72, 112, 152, 192, 232];

const frequencies = ["250", "500", "1k", "2k", "3k", "4k", "8k"];

const sampleDocuments = [
  {
    title: "Registro de consulta",
    description: "Documento de demonstração",
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

      <p className="chart-disclaimer">
        Visualização ilustrativa. Os pontos não representam resultados
        de um paciente real e não devem ser usados para interpretação clínica.
      </p>
    </div>
  );
}

export default function Prontuario() {
  const { id } = useParams();
  const patient = patientSamples[id] ?? patientSamples["3"];

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
    showToast(
      "Texto de demonstração inserido. Nenhuma gravação ou transcrição por IA foi realizada."
    );
  }

  function handleSave() {
    showToast(
      "Rascunho mantido apenas nesta tela. O salvamento permanente será integrado ao backend."
    );
  }

  function handleUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploadedFile(file.name);
    showToast(
      `Arquivo "${file.name}" selecionado. O upload seguro ainda não está integrado.`
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">ATENDIMENTO CLÍNICO</span>
          <h2 className="page-title">Prontuário eletrônico</h2>
          <p className="page-subtitle">
            Consulte e prepare o registro clínico do atendimento.
          </p>
        </div>

        <Btn variant="secondary" onClick={() => window.history.back()}>
          ← Voltar
        </Btn>
      </section>

      <section className="patient-overview">
        <div className="patient-overview-main">
          <div className="patient-large-avatar">{patient.initials}</div>

          <div>
            <div className="patient-name-row">
              <h3>{patient.name}</h3>
              <span className="status-pill status-confirmed">
                Registro demonstrativo
              </span>
            </div>

            <p>Paciente fictício · Identificador {id}</p>

            <div className="patient-metadata">
              <span>Consulta ilustrativa</span>
              <span>{patient.specialty}</span>
              <span>{patient.modality}</span>
            </div>
          </div>
        </div>

        <div className="overview-actions">
          <span className="record-status">
            <span className="status-indicator" />
            Rascunho local
          </span>
        </div>
      </section>

      <div className="record-layout">
        <div className="record-primary">
          <Card
            title="Registro clínico"
            description="Organize as informações do atendimento."
          >
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
                  <span>
                    {anamnese.length} caracteres
                  </span>

                  <Btn
                    variant="outline"
                    onClick={simulateTranscription}
                    disabled={transcribing}
                  >
                    {transcribing
                      ? "Processando..."
                      : "✧ Simular transcrição por IA"}
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

                <p className="field-help">
                  O conteúdo inserido ainda não é persistido em um banco de dados.
                </p>
              </div>
            )}

            {activeSection === "documentos" && (
              <div className="record-section">
                <h3 className="subsection-title">
                  Documentos do atendimento
                </h3>

                <p className="section-description">
                  Selecione um arquivo local para visualizar o fluxo de
                  anexação. Nenhum arquivo será enviado a um servidor.
                </p>

                <label className="upload-zone">
                  <span className="upload-icon">↑</span>
                  <strong>Selecionar documento</strong>
                  <span>Escolha um arquivo do seu computador</span>

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
                      <small>Selecionado localmente</small>
                    </span>
                  </div>
                )}

                <div className="document-list">
                  {sampleDocuments.map((document) => (
                    <div
                      className="document-row"
                      key={document.title}
                    >
                      <span className="file-icon">▤</span>

                      <div>
                        <strong>{document.title}</strong>
                        <small>{document.description}</small>
                      </div>

                      <span className="file-type">
                        {document.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card-footer-actions">
              <span className="save-caption">
                Alterações mantidas apenas nesta sessão.
              </span>

              <Btn onClick={handleSave}>Salvar rascunho</Btn>
            </div>
          </Card>

          <Card
            title="Audiometria"
            description="Representação visual de um exame auditivo"
          >
            <Audiogram />
          </Card>

          <Card
            title="Timpanometria"
            description="Área reservada à visualização das curvas timpanométricas"
          >
            <div className="coming-soon-panel">
              <span className="coming-soon-icon">⌁</span>

              <div>
                <strong>Componente de timpanometria</strong>
                <p>
                  O gráfico interativo, os parâmetros do exame e o
                  armazenamento dos resultados serão implementados na
                  próxima etapa.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="record-secondary">
          <Card
            title="Resumo do atendimento"
            description="Informações demonstrativas"
          >
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
                <strong>#{id}</strong>
              </div>
            </div>

            <div className="privacy-note">
              <span aria-hidden="true">▣</span>
              <p>
                Em produção, o prontuário deverá utilizar controle de
                acesso, trilha de auditoria e proteção dos dados sensíveis.
              </p>
            </div>
          </Card>

          <Card
            title="Multimídia clínica"
            description="Área de comparação antes e depois"
          >
            <div className="media-comparison">
              <div className="media-item">
                <div className="media-thumbnail media-before">
                  <span>01</span>
                </div>

                <div className="media-information">
                  <strong>Antes do tratamento</strong>
                  <small>Áudio não configurado</small>
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
                  <strong>Após o tratamento</strong>
                  <small>Áudio não configurado</small>
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

            <p className="field-help">
              A reprodução sincronizada depende dos arquivos de mídia e
              do componente de comparação.
            </p>
          </Card>

          <Card title="Próximas etapas">
            <div className="next-steps-list">
              <div>
                <span className="step-marker">1</span>
                <span>
                  <strong>Registrar avaliação</strong>
                  <small>Conferir as informações clínicas</small>
                </span>
              </div>

              <div>
                <span className="step-marker">2</span>
                <span>
                  <strong>Documentar conduta</strong>
                  <small>Preencher a evolução do atendimento</small>
                </span>
              </div>

              <div>
                <span className="step-marker">3</span>
                <span>
                  <strong>Finalizar registro</strong>
                  <small>Fluxo de finalização ainda não implementado</small>
                </span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}