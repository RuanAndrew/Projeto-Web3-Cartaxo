import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";

const patients = [
  {
    id: "1",
    name: "Ana Beatriz Lima",
    initials: "AL",
    specialty: "Otorrinolaringologia",
    modality: "Presencial",
    color: "lavender",
  },
  {
    id: "2",
    name: "Pedro Henrique Costa",
    initials: "PC",
    specialty: "Fonoaudiologia",
    modality: "Teleconsulta",
    color: "mint",
  },
  {
    id: "3",
    name: "João Silva",
    initials: "JS",
    specialty: "Otorrinolaringologia",
    modality: "Teleconsulta",
    color: "peach",
  },
  {
    id: "4",
    name: "Mariana Oliveira",
    initials: "MO",
    specialty: "Fonoaudiologia",
    modality: "Presencial",
    color: "blue",
  },
];

export default function Prontuarios() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const filteredPatients = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return patients;
    }

    return patients.filter((patient) => {
      return (
        patient.name.toLowerCase().includes(search) ||
        patient.specialty.toLowerCase().includes(search)
      );
    });
  }, [query]);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">ÁREA CLÍNICA</span>

          <h2 className="page-title">Prontuários</h2>

          <p className="page-subtitle">
            Pesquise um paciente para consultar seu prontuário clínico.
          </p>
        </div>
      </section>

      <section className="record-menu-summary">
        <div className="record-menu-summary-icon">▤</div>

        <div>
          <strong>Prontuário eletrônico</strong>

          <p>
            Consulte registros clínicos e acesse as áreas de anamnese,
            evolução, exames e documentos.
          </p>
        </div>
      </section>

      <div className="page-toolbar">
        <div>
          <h3 className="section-title">Pacientes</h3>

          <p className="section-description">
            Dados fictícios para navegação e avaliação do frontend.
          </p>
        </div>

        <label className="search-field">
          <span className="search-symbol" aria-hidden="true">
            ⌕
          </span>

          <input
            type="search"
            aria-label="Buscar paciente"
            placeholder="Buscar por nome ou especialidade..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <Card
        title="Lista de pacientes"
        description={`${filteredPatients.length} paciente(s) encontrado(s)`}
      >
        {filteredPatients.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">⌕</span>

            <strong>Nenhum paciente encontrado</strong>

            <p>
              Verifique a busca ou tente pesquisar por outra especialidade.
            </p>

            <Btn
              variant="secondary"
              onClick={() => setQuery("")}
            >
              Limpar pesquisa
            </Btn>
          </div>
        ) : (
          <div className="records-list">
            {filteredPatients.map((patient) => (
              <article className="record-list-row" key={patient.id}>
                <div
                  className={`patient-avatar avatar-${patient.color}`}
                  aria-hidden="true"
                >
                  {patient.initials}
                </div>

                <div className="record-list-patient">
                  <strong>{patient.name}</strong>

                  <span>{patient.specialty}</span>

                  <small>{patient.modality}</small>
                </div>

                <Btn
                  variant="outline"
                  size="small"
                  onClick={() =>
                    navigate(`/prontuario/${patient.id}`)
                  }
                >
                  Abrir prontuário <span aria-hidden="true">→</span>
                </Btn>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}