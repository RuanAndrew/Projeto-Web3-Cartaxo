import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import {
  listarEspecialidades,
  listarProfissionais,
} from "../services/profissionaisApi.js";
import {
  garantirSessaoValida,
  obterToken,
  removerToken,
} from "../utils/auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const FALLBACK_PATIENTS = [
  {
    id: "1",
    code: "PRT-001",
    name: "Ana Beatriz Lima",
    cpf: "123.456.789-01",
    initials: "AL",
    specialty: "Otorrinolaringologia",
    modality: "Presencial",
    lastVisit: "09/11/2026",
    doctorName: "Ana",
  },
  {
    id: "2",
    code: "PRT-002",
    name: "Pedro Henrique Costa",
    cpf: "234.567.890-12",
    initials: "PC",
    specialty: "Fonoaudiologia",
    modality: "Teleconsulta",
    lastVisit: "10/11/2026",
    doctorName: "Ana",
  },
  {
    id: "3",
    code: "PRT-003",
    name: "João Silva",
    cpf: "345.678.901-23",
    initials: "JS",
    specialty: "Otorrinolaringologia",
    modality: "Teleconsulta",
    lastVisit: "12/11/2026",
    doctorName: "Ana",
  },
  {
    id: "4",
    code: "PRT-004",
    name: "Mariana Oliveira",
    cpf: "456.789.012-34",
    initials: "MO",
    specialty: "Fonoaudiologia",
    modality: "Presencial",
    lastVisit: "14/11/2026",
    doctorName: "Ana",
  },
];

const ESPECIALIDADES_PADRAO = ["Otorrinolaringologia", "Fonoaudiologia"];

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

function normalizarTexto(texto = "") {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function formatarCpf(cpf = "") {
  const digitos = String(cpf || "").replace(/\D/g, "");
  if (digitos.length !== 11) return "";
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatDateShort(value) {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SpecialtySearchCombobox({
  specialties,
  value,
  onChange,
  countsBySpecialty,
  totalCount,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filteredSpecialties = useMemo(() => {
    const term = normalizarTexto(search);
    if (!term) return specialties;
    return specialties.filter((esp) => normalizarTexto(esp).includes(term));
  }, [specialties, search]);

  function handleSelect(val) {
    onChange(val);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="doctor-combobox records-specialty-combobox" ref={containerRef}>
      <div
        className={`doctor-combobox-control ${
          open ? "doctor-combobox-control-open" : ""
        }`}
      >
        <span className="doctor-combobox-icon" aria-hidden="true">
          ✦
        </span>

        {open ? (
          <input
            ref={inputRef}
            type="text"
            className="doctor-combobox-input"
            placeholder="Filtrar especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar especialidade"
          />
        ) : (
          <button
            type="button"
            className="doctor-combobox-selected-btn"
            onClick={() => {
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            title="Filtrar por especialidade"
          >
            <span className="doctor-combobox-selected-name">
              {value === "Todas" ? "Todas as especialidades" : value}
            </span>
            <span className="doctor-combobox-selected-meta">
              {value === "Todas"
                ? totalCount
                : countsBySpecialty[value] ?? 0}
            </span>
          </button>
        )}

        {value !== "Todas" && (
          <button
            type="button"
            className="doctor-combobox-clear"
            aria-label="Limpar filtro de especialidade"
            title="Mostrar todas as especialidades"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect("Todas");
            }}
          >
            ✕
          </button>
        )}

        <button
          type="button"
          className="doctor-combobox-toggle"
          aria-label="Abrir lista de especialidades"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="doctor-combobox-dropdown" role="listbox">
          <div className="doctor-combobox-status">
            <span>{specialties.length} especialidade(s) disponíveis</span>
            <small>Digite para filtrar</small>
          </div>

          <ul className="doctor-combobox-list">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === "Todas"}
                className={`doctor-combobox-option ${
                  value === "Todas" ? "doctor-combobox-option-selected" : ""
                }`}
                onClick={() => handleSelect("Todas")}
              >
                <span className="doctor-combobox-option-copy">
                  <strong>Todas as especialidades</strong>
                </span>
                <span className="doctor-combobox-selected-meta">
                  {totalCount}
                </span>
              </button>
            </li>

            {filteredSpecialties.length === 0 ? (
              <li className="doctor-combobox-empty">
                Nenhuma especialidade encontrada para &ldquo;{search}&rdquo;.
              </li>
            ) : (
              filteredSpecialties.map((esp) => {
                const isSelected = value === esp;
                const count = countsBySpecialty[esp] ?? 0;
                return (
                  <li key={esp}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`doctor-combobox-option ${
                        isSelected ? "doctor-combobox-option-selected" : ""
                      }`}
                      onClick={() => handleSelect(esp)}
                    >
                      <span className="doctor-combobox-option-copy">
                        <strong>{esp}</strong>
                      </span>
                      <span className="doctor-combobox-selected-meta">
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Prontuarios() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("Todas");
  const [modalityFilter, setModalityFilter] = useState("Todas");
  const [letterFilter, setLetterFilter] = useState("Todas");
  const [viewMode, setViewMode] = useState("list"); // "list" | "grid"
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [searchingServer, setSearchingServer] = useState(false);
  const [rawPatients, setRawPatients] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [appointments, setAppointments] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [especialidadesCatalogo, setEspecialidadesCatalogo] = useState(
    ESPECIALIDADES_PADRAO
  );

  // Debounce da busca textual para suportar grandes bases (100k+ pacientes)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Resetar para página 1 sempre que filtros mudarem
  useEffect(() => {
    setPage(1);
  }, [
    debouncedQuery,
    specialtyFilter,
    modalityFilter,
    letterFilter,
    pageSize,
  ]);

  // Carrega especialidades, profissionais e agendamentos para enriquecer os prontuários
  useEffect(() => {
    let ativo = true;

    async function carregarContextoClinico() {
      const [espRes, profRes, agRes] = await Promise.allSettled([
        listarEspecialidades(),
        listarProfissionais({ ativo: true }),
        fetchComSessao(`${API_URL}/agendamentos`).then((r) =>
          r.ok ? r.json() : []
        ),
      ]);

      if (!ativo) return;

      if (espRes.status === "fulfilled" && Array.isArray(espRes.value)) {
        const nomes = espRes.value
          .map((e) => String(e?.nome || "").trim())
          .filter(Boolean);
        if (nomes.length > 0) {
          setEspecialidadesCatalogo(
            Array.from(new Set([...ESPECIALIDADES_PADRAO, ...nomes]))
          );
        }
      }

      if (profRes.status === "fulfilled" && Array.isArray(profRes.value)) {
        setProfissionais(profRes.value);
      }

      if (agRes.status === "fulfilled" && Array.isArray(agRes.value)) {
        setAppointments(agRes.value);
      }
    }

    carregarContextoClinico();
    return () => {
      ativo = false;
    };
  }, []);

  // Busca pacientes paginados do backend (com fallback/merge para pacientes demonstrativos)
  useEffect(() => {
    let ativo = true;

    async function buscarPacientes() {
      setSearchingServer(true);
      try {
        const termoBusca =
          debouncedQuery ||
          (letterFilter !== "Todas" ? letterFilter : "");
        const params = new URLSearchParams({
          page: "1",
          limit: "100",
          ativo: "true",
          ...(termoBusca ? { busca: termoBusca } : {}),
        });

        const resp = await fetchComSessao(
          `${API_URL}/api/v1/pacientes?${params.toString()}`
        );

        if (!ativo) return;

        if (resp.ok) {
          const data = await resp.json();
          const items = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
              ? data.items
              : [];
          setRawPatients(items);
          setServerTotal(
            typeof data?.total === "number" ? data.total : items.length
          );
        }
      } catch {
        /* mantém fallback local */
      } finally {
        if (ativo) {
          setLoading(false);
          setSearchingServer(false);
        }
      }
    }

    buscarPacientes();
    return () => {
      ativo = false;
    };
  }, [debouncedQuery, letterFilter]);

  // Mapa de profissionais e último agendamento por paciente
  const ultimoAgendamentoPorPaciente = useMemo(() => {
    const profMap = {};
    profissionais.forEach((prof, idx) => {
      if (prof?.id) profMap[String(prof.id).toLowerCase()] = prof;
      if (idx === 0) {
        profMap["119d0caf-2b76-4782-85a5-65937af47356"] = prof;
      }
    });

    const mapa = {};
    const ordenados = [...appointments].sort(
      (a, b) =>
        new Date(b.data_hora || 0).getTime() -
        new Date(a.data_hora || 0).getTime()
    );

    for (const apt of ordenados) {
      const pid = String(apt?.paciente_id || "").toLowerCase();
      if (!pid || mapa[pid]) continue;
      const prof =
        profMap[String(apt?.profissional_id || "").toLowerCase()] ||
        profissionais[0] ||
        null;
      const especialidade =
        prof?.especialidades?.[0]?.nome || "Fonoaudiologia";

      mapa[pid] = {
        specialty: especialidade,
        modality:
          apt.modalidade === "teleconsulta" ? "Teleconsulta" : "Presencial",
        lastVisit: formatDateShort(apt.data_hora),
        doctorName: prof?.nome || "Ana",
      };
    }

    return mapa;
  }, [appointments, profissionais]);

  // Unifica pacientes reais do backend com os registros clínicos vinculados
  const allPatients = useMemo(() => {
    const resultado = [];
    const nomesVistos = new Set();

    rawPatients.forEach((pac, index) => {
      const idStr = String(pac.id);
      const nome = String(pac.nome_completo || pac.nome || "").trim();
      if (!nome) return;
      nomesVistos.add(normalizarTexto(nome));

      const agInfo = ultimoAgendamentoPorPaciente[idStr.toLowerCase()];
      const fallbackMatch = FALLBACK_PATIENTS.find(
        (fp) => normalizarTexto(fp.name) === normalizarTexto(nome)
      );

      resultado.push({
        id: idStr,
        name: nome,
        cpf: formatarCpf(pac.cpf) || fallbackMatch?.cpf || "",
        telefone: pac.telefone_principal || "",
        initials: obterIniciais(nome),
        specialty:
          agInfo?.specialty ||
          fallbackMatch?.specialty ||
          especialidadesCatalogo[index % especialidadesCatalogo.length] ||
          "Atendimento Clínico",
        modality:
          agInfo?.modality || fallbackMatch?.modality || "Presencial",
        lastVisit:
          agInfo?.lastVisit ||
          fallbackMatch?.lastVisit ||
          formatDateShort(pac.updated_at || pac.created_at),
        doctorName:
          agInfo?.doctorName ||
          fallbackMatch?.doctorName ||
          profissionais[0]?.nome ||
          "Ana",
      });
    });

    for (const fp of FALLBACK_PATIENTS) {
      if (!nomesVistos.has(normalizarTexto(fp.name))) {
        resultado.push(fp);
      }
    }

    return resultado
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item, idx) => ({
        ...item,
        code: `PRT-${String(idx + 1).padStart(3, "0")}`,
      }));
  }, [
    rawPatients,
    ultimoAgendamentoPorPaciente,
    especialidadesCatalogo,
    profissionais,
  ]);

  // Lista completa de especialidades (catálogo + encontradas nos pacientes)
  const todasEspecialidades = useMemo(() => {
    const set = new Set(especialidadesCatalogo);
    for (const p of allPatients) {
      if (p.specialty) set.add(p.specialty);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [especialidadesCatalogo, allPatients]);

  const countsBySpecialty = useMemo(() => {
    const counts = {};
    for (const p of allPatients) {
      counts[p.specialty] = (counts[p.specialty] || 0) + 1;
    }
    return counts;
  }, [allPatients]);

  // Filtragem combinada (busca por nome/CPF/código/especialidade + especialidade + letra inicial)
  const filteredPatients = useMemo(() => {
    const searchNorm = normalizarTexto(query);
    const searchDigits = query.replace(/\D/g, "");

    return allPatients.filter((patient) => {
      const matchesSpecialty =
        specialtyFilter === "Todas" || patient.specialty === specialtyFilter;

      const matchesLetter =
        letterFilter === "Todas" ||
        normalizarTexto(patient.name)
          .toUpperCase()
          .startsWith(letterFilter);

      const matchesSearch =
        !searchNorm ||
        normalizarTexto(patient.name).includes(searchNorm) ||
        normalizarTexto(patient.specialty).includes(searchNorm) ||
        normalizarTexto(patient.code).includes(searchNorm) ||
        (searchDigits &&
          String(patient.cpf || "")
            .replace(/\D/g, "")
            .includes(searchDigits));

      return (
        matchesSpecialty &&
        matchesLetter &&
        matchesSearch
      );
    });
  }, [
    allPatients,
    query,
    specialtyFilter,
    letterFilter,
  ]);

  // Paginação
  const totalFiltered = filteredPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  const startIndex = totalFiltered === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalFiltered);

  const temFiltroAtivo =
    Boolean(query.trim()) ||
    specialtyFilter !== "Todas" ||
    letterFilter !== "Todas";

  function limparTodosFiltros() {
    setQuery("");
    setSpecialtyFilter("Todas");
    setLetterFilter("Todas");
    setPage(1);
  }

  function abrirProntuario(patient) {
    navigate(`/prontuario/${patient.id}`, {
      state: { patient },
    });
  }

  return (
    <div className="page-stack">
      <Card className="doctor-schedule-board records-scalable-card">
        {/* CABEÇALHO PADRONIZADO COM A TELA DE AGENDAMENTO */}
        <header className="doctor-schedule-board-header records-scalable-header">
          <div className="doctor-schedule-title-row">
            <div>
              <h2 className="card-title">Prontuários de Pacientes</h2>
              <p className="doctor-schedule-subtitle">
                Busque por nome, CPF, código ou filtre por especialidade e letra
                inicial
              </p>
            </div>

            <div className="records-header-badges">
              {searchingServer && (
                <span className="records-sync-pill">Sincronizando base...</span>
              )}
              <span className="records-count-badge">
                {serverTotal > allPatients.length
                  ? `${totalFiltered} exibido(s) de ${serverTotal}`
                  : `${totalFiltered} paciente(s)`}
              </span>
            </div>
          </div>

          {/* BARRA DE BUSCA E FILTROS ESCALÁVEIS (PARA 100K+ PACIENTES E DEZENAS DE ESPECIALIDADES) */}
          <div className="records-scalable-filters-grid">
            <label className="search-field records-main-search">
              <span className="search-symbol" aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                aria-label="Buscar paciente por nome, CPF, código ou especialidade"
                placeholder="Pesquisar paciente por nome, CPF ou código (ex.: PRT-001)..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="records-search-clear-btn"
                  onClick={() => setQuery("")}
                  aria-label="Limpar texto da busca"
                >
                  ✕
                </button>
              )}
            </label>

            <SpecialtySearchCombobox
              specialties={todasEspecialidades}
              value={specialtyFilter}
              onChange={setSpecialtyFilter}
              countsBySpecialty={countsBySpecialty}
              totalCount={allPatients.length}
            />

            <div
              className="records-view-toggle"
              role="group"
              aria-label="Modo de exibição"
            >
              <button
                type="button"
                className={`records-view-btn ${
                  viewMode === "list" ? "records-view-btn-active" : ""
                }`}
                onClick={() => setViewMode("list")}
                title="Exibir em lista vertical padronizada (igual à Agenda)"
              >
                ☰ Lista
              </button>
              <button
                type="button"
                className={`records-view-btn ${
                  viewMode === "grid" ? "records-view-btn-active" : ""
                }`}
                onClick={() => setViewMode("grid")}
                title="Exibir em grade de 2 colunas"
              >
                ⊞ Grade
              </button>
            </div>
          </div>

          {/* ÍNDICE ALFABÉTICO RÁPIDO (A-Z) PARA NAVEGAÇÃO EM GRANDES VOLUMES */}
          <div className="records-alphabet-bar" role="toolbar" aria-label="Filtro rápido por letra inicial">
            <button
              type="button"
              className={`records-alpha-btn ${
                letterFilter === "Todas" ? "records-alpha-btn-active" : ""
              }`}
              onClick={() => setLetterFilter("Todas")}
            >
              Todos
            </button>
            {ALFABETO.map((letra) => (
              <button
                key={letra}
                type="button"
                className={`records-alpha-btn ${
                  letterFilter === letra ? "records-alpha-btn-active" : ""
                }`}
                onClick={() =>
                  setLetterFilter((curr) => (curr === letra ? "Todas" : letra))
                }
              >
                {letra}
              </button>
            ))}
          </div>

          {/* CHIPS DE FILTROS ATIVOS */}
          {temFiltroAtivo && (
            <div className="records-active-filters-bar">
              <span className="records-active-filters-label">
                Filtros ativos:
              </span>
              {query.trim() && (
                <span className="records-active-filter-chip">
                  Busca: &ldquo;{query.trim()}&rdquo;
                  <button type="button" onClick={() => setQuery("")}>
                    ✕
                  </button>
                </span>
              )}
              {specialtyFilter !== "Todas" && (
                <span className="records-active-filter-chip">
                  Especialidade: {specialtyFilter}
                  <button
                    type="button"
                    onClick={() => setSpecialtyFilter("Todas")}
                  >
                    ✕
                  </button>
                </span>
              )}
              {letterFilter !== "Todas" && (
                <span className="records-active-filter-chip">
                  Inicial: {letterFilter}
                  <button
                    type="button"
                    onClick={() => setLetterFilter("Todas")}
                  >
                    ✕
                  </button>
                </span>
              )}

              <button
                type="button"
                className="records-clear-all-link"
                onClick={limparTodosFiltros}
              >
                Limpar todos os filtros
              </button>
            </div>
          )}
        </header>

        {/* LISTAGEM DE PACIENTES COM COR UNIFORME PADRONIZADA */}
        {loading ? (
          <div className="empty-state">
            <strong>Carregando diretório de prontuários...</strong>
          </div>
        ) : paginatedPatients.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">⌕</span>
            <strong>Nenhum paciente encontrado</strong>
            <p>
              Verifique os termos informados ou altere os filtros de
              especialidade e letra inicial.
            </p>
            <Btn variant="secondary" size="sm" onClick={limparTodosFiltros}>
              Limpar filtros
            </Btn>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "records-standardized-grid"
                  : "doctor-patient-stack"
              }
            >
              {paginatedPatients.map((patient) => (
                <article
                  key={patient.id}
                  className="doctor-patient-card records-patient-card-clickable"
                  onClick={() => abrirProntuario(patient)}
                >
                  <div className="doctor-patient-time-box records-code-box">
                    <strong className="records-code-number">
                      {patient.code}
                    </strong>
                    <span className="doctor-patient-duration">Prontuário</span>
                    <small className="doctor-patient-date">
                      {patient.lastVisit}
                    </small>
                  </div>

                  <div className="doctor-patient-main">
                    <div
                      className="patient-avatar doctor-uniform-avatar"
                      aria-hidden="true"
                    >
                      {patient.initials}
                    </div>

                    <div className="doctor-patient-details">
                      <div className="doctor-patient-top-row">
                        <h3 className="doctor-patient-name">{patient.name}</h3>
                      </div>

                      <div className="doctor-patient-badges">
                        <span className="patient-record-badge">
                          {patient.specialty}
                        </span>
                        {patient.cpf && (
                          <span className="patient-record-badge">
                            CPF {patient.cpf}
                          </span>
                        )}
                        {patient.doctorName && (
                          <span className="patient-record-badge">
                            Dr(a). {patient.doctorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="doctor-patient-actions">
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        abrirProntuario(patient);
                      }}
                    >
                      Abrir prontuário <span aria-hidden="true">→</span>
                    </Btn>
                  </div>
                </article>
              ))}
            </div>

            {/* RODAPÉ DE PAGINAÇÃO ESCALÁVEL */}
            <footer className="records-pagination-footer">
              <div className="records-pagination-summary">
                <span>
                  Exibindo{" "}
                  <strong>
                    {startIndex}–{endIndex}
                  </strong>{" "}
                  de <strong>{totalFiltered}</strong> paciente(s)
                </span>

                <label className="records-pagesize-label">
                  <span>Exibir:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Quantidade de pacientes por página"
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                  </select>
                </label>
              </div>

              <div className="records-pagination-controls">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                  title="Primeira página"
                >
                  «
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Anterior
                </button>

                <span className="patient-page-indicator">
                  Página <strong>{currentPage}</strong> de{" "}
                  <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima →
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  title="Última página"
                >
                  »
                </button>
              </div>
            </footer>
          </>
        )}
      </Card>
    </div>
  );
}
