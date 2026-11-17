import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";

const patients = [
  {
    id: "1",
    code: "PRT-001",
    name: "Ana Beatriz Lima",
    initials: "AL",
    specialty: "Otorrinolaringologia",
    modality: "Presencial",
    lastVisit: "09/11/2026",
    status: "Em acompanhamento",
    color: "lavender",
  },
  {
    id: "2",
    code: "PRT-002",
    name: "Pedro Henrique Costa",
    initials: "PC",
    specialty: "Fonoaudiologia",
    modality: "Teleconsulta",
    lastVisit: "10/11/2026",
    status: "Em acompanhamento",
    color: "mint",
  },
  {
    id: "3",
    code: "PRT-003",
    name: "João Silva",
    initials: "JS",
    specialty: "Otorrinolaringologia",
    modality: "Teleconsulta",
    lastVisit: "12/11/2026",
    status: "Retorno agendado",
    color: "peach",
  },
  {
    id: "4",
    code: "PRT-004",
    name: "Mariana Oliveira",
    initials: "MO",
    specialty: "Fonoaudiologia",
    modality: "Presencial",
    lastVisit: "14/11/2026",
    status: "Em acompanhamento",
    color: "blue",
  },
];

const ESPECIALIDADES_FILTRO = [
  "Todas",
  "Otorrinolaringologia",
  "Fonoaudiologia",
];

export default function Prontuarios() {
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("Todas");
  const navigate = useNavigate();

  const filteredPatients = useMemo(() => {
    const search = query.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSpecialty =
        specialtyFilter === "Todas" || patient.specialty === specialtyFilter;

      const matchesSearch =
        !search ||
        patient.name.toLowerCase().includes(search) ||
        patient.specialty.toLowerCase().includes(search) ||
        patient.code.toLowerCase().includes(search);

      return matchesSpecialty && matchesSearch;
    });
  }, [query, specialtyFilter]);

  return (
    <div className="page-stack">
      <Card>
        <div className="records-Directory-header">
          <div className="records-directory-title-group">
            <h3 className="card-title">Pacientes vinculados</h3>
            <span className="records-count-badge">
              {filteredPatients.length} paciente(s)
            </span>
          </div>

          <div className="records-directory-controls">
            <div
              className="records-specialty-pills"
              role="group"
              aria-label="Filtrar por especialidade"
            >
              {ESPECIALIDADES_FILTRO.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`records-filter-pill ${
                    specialtyFilter === item ? "records-filter-pill-active" : ""
                  }`}
                  onClick={() => setSpecialtyFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="search-field records-search-field">
              <span className="search-symbol" aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                aria-label="Buscar paciente"
                placeholder="Buscar por nome, código ou especialidade..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">⌕</span>

            <strong>Nenhum paciente encontrado</strong>

            <p>
              Verifique os termos informados ou altere o filtro de
              especialidade.
            </p>

            <Btn
              variant="secondary"
              onClick={() => {
                setQuery("");
                setSpecialtyFilter("Todas");
              }}
            >
              Limpar filtros
            </Btn>
          </div>
        ) : (
          <div className="patient-records-grid">
            {filteredPatients.map((patient) => (
              <article
                className="patient-record-card"
                key={patient.id}
                onClick={() => navigate(`/prontuario/${patient.id}`)}
              >
                <div className="patient-record-card-main">
                  <div
                    className={`patient-avatar avatar-${patient.color}`}
                    aria-hidden="true"
                  >
                    {patient.initials}
                  </div>

                  <div className="patient-record-info">
                    <div className="patient-record-name-line">
                      <strong>{patient.name}</strong>
                      <span className="patient-record-code">
                        {patient.code}
                      </span>
                    </div>

                    <div className="patient-record-tags">
                      <span className="patient-record-badge patient-record-badge-specialty">
                        {patient.specialty}
                      </span>
                      <span
                        className={`patient-record-badge ${
                          patient.modality === "Teleconsulta"
                            ? "patient-record-badge-remote"
                            : "patient-record-badge-presential"
                        }`}
                      >
                        {patient.modality}
                      </span>
                    </div>

                    <small className="patient-record-meta">
                      Último registro: {patient.lastVisit} · {patient.status}
                    </small>
                  </div>
                </div>

                <div className="patient-record-card-action">
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/prontuario/${patient.id}`);
                    }}
                  >
                    Abrir prontuário <span aria-hidden="true">→</span>
                  </Btn>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}