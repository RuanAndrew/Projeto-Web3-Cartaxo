import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/ToastProvider.jsx";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import { listarProfissionais } from "../services/profissionaisApi.js";
import {
  garantirSessaoValida,
  lerPayload,
  obterToken,
  removerToken,
} from "../utils/auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const FILTROS_AGENDA = [
  { id: "Todas", label: "Todos" },
  { id: "Pendentes", label: "Próximos" },
  { id: "Concluídas", label: "Concluídos" },
  { id: "Canceladas", label: "Cancelados / Faltas" },
];

const initialFormData = {
  paciente_id: "",
  profissional_id: "",
  data: "",
  horario: "",
  duracao_minutos: "30",
  modalidade: "presencial",
  link_teleconsulta: "",
};

const PROFISSIONAL_UUID_PADRAO = "119d0caf-2b76-4782-85a5-65937af47356";

function resolverUuidProfissional(prof, index = 0, usuarioAtual = null) {
  const idStr = String(prof?.id || "").trim();
  if (UUID_REGEX.test(idStr)) return idStr;
  if (index === 0) {
    if (
      usuarioAtual?.perfil === "PROFISSIONAL" &&
      UUID_REGEX.test(String(usuarioAtual?.sub || ""))
    ) {
      return String(usuarioAtual.sub);
    }
    return PROFISSIONAL_UUID_PADRAO;
  }
  const sufixo = idStr.replace(/\D/g, "").padStart(12, "0").slice(-12) || String(index + 1).padStart(12, "0");
  return `00000000-0000-4000-8000-${sufixo}`;
}

function obterNomePaciente(paciente) {
  return String(paciente?.nome_completo || paciente?.nome || "").trim();
}

function formatarCpf(cpf = "") {
  const digitos = String(cpf || "").replace(/\D/g, "");
  if (digitos.length !== 11) return "";
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizarTexto(texto = "") {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function SearchableCombobox({
  id,
  label,
  placeholder,
  value,
  options,
  selectedOption,
  onSelect,
  onSearchChange,
  searching = false,
  emptyMessage = "Nenhum resultado encontrado.",
  hintText = "Digite para pesquisar na base",
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [searchTerm, options.length]);

  function abrirBusca() {
    setOpen(true);
    setSearchTerm("");
    if (onSearchChange) onSearchChange("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  function handleInputChange(e) {
    const novoTermo = e.target.value;
    setSearchTerm(novoTermo);
    if (!open) setOpen(true);
    if (onSearchChange) onSearchChange(novoTermo);
  }

  function selecionarItem(item) {
    onSelect(item ? item.value : "");
    setOpen(false);
    setSearchTerm("");
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        abrirBusca();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        options.length > 0 ? (prev + 1) % options.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        options.length > 0
          ? (prev - 1 + options.length) % options.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[highlightIndex]) {
        selecionarItem(options[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearchTerm("");
    }
  }

  return (
    <div className="patient-field doctor-combobox" ref={containerRef}>
      <label className="doctor-combobox-label" htmlFor={id}>
        {label}
      </label>

      <div
        className={`doctor-combobox-control ${
          open ? "doctor-combobox-control-open" : ""
        }`}
      >
        <span className="doctor-combobox-icon" aria-hidden="true">
          ⌕
        </span>

        {open || !selectedOption ? (
          <input
            ref={inputRef}
            id={id}
            type="text"
            autoComplete="off"
            className="doctor-combobox-input"
            placeholder={
              selectedOption ? selectedOption.label : placeholder
            }
            value={searchTerm}
            onFocus={() => {
              if (!open) {
                setOpen(true);
                if (onSearchChange) onSearchChange(searchTerm);
              }
            }}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <button
            type="button"
            id={id}
            className="doctor-combobox-selected-btn"
            onClick={abrirBusca}
            title="Clique para pesquisar outro registro"
          >
            <span className="doctor-combobox-selected-name">
              {selectedOption.label}
            </span>
            {selectedOption.badge && (
              <span className="doctor-combobox-selected-meta">
                {selectedOption.badge}
              </span>
            )}
          </button>
        )}

        {value && (
          <button
            type="button"
            className="doctor-combobox-clear"
            aria-label={`Limpar ${label}`}
            title="Limpar seleção"
            onClick={(e) => {
              e.stopPropagation();
              selecionarItem(null);
              abrirBusca();
            }}
          >
            ✕
          </button>
        )}

        <button
          type="button"
          className="doctor-combobox-toggle"
          aria-label={`Abrir lista de ${label}`}
          onClick={() => (open ? setOpen(false) : abrirBusca())}
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="doctor-combobox-dropdown" role="listbox">
          <div className="doctor-combobox-status">
            <span>
              {searching
                ? "Pesquisando na base de dados..."
                : `${options.length} resultado(s) exibido(s)`}
            </span>
            <small>{hintText}</small>
          </div>

          {options.length === 0 ? (
            <div className="doctor-combobox-empty">
              {searching ? "Carregando..." : emptyMessage}
            </div>
          ) : (
            <ul className="doctor-combobox-list">
              {options.map((item, idx) => {
                const isSelected = String(item.value) === String(value);
                const isHighlighted = idx === highlightIndex;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`doctor-combobox-option ${
                        isHighlighted ? "doctor-combobox-option-active" : ""
                      } ${isSelected ? "doctor-combobox-option-selected" : ""}`}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => selecionarItem(item)}
                    >
                      <span
                        className="doctor-combobox-avatar"
                        aria-hidden="true"
                      >
                        {item.initials}
                      </span>
                      <span className="doctor-combobox-option-copy">
                        <strong>{item.label}</strong>
                        {item.subtitle && <small>{item.subtitle}</small>}
                      </span>
                      {isSelected && (
                        <span
                          className="doctor-combobox-check"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function indexarPaciente(mapa, paciente) {
  if (!paciente) return;
  if (paciente.id) {
    mapa[String(paciente.id).toLowerCase()] = paciente;
  }
  if (paciente.user_account_id) {
    mapa[String(paciente.user_account_id).toLowerCase()] = paciente;
  }
}

function initialsFromName(name) {
  const partes = String(name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zÀ-ÿ]/g, ""))
    .filter(Boolean);
  if (partes.length === 0) return "PC";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function formatDateShort(value) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obterDataLocalIso(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterHojeLocalIso() {
  return obterDataLocalIso(new Date());
}

function ehAgendamentoDeDataPassada(dataHora) {
  const dataAg = obterDataLocalIso(dataHora);
  if (!dataAg) return false;
  return dataAg < obterHojeLocalIso();
}

function minutosDoDiaLocal(dataHora) {
  if (!dataHora) return 0;
  const d = new Date(dataHora);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function resumirUuid(id) {
  const texto = String(id || "");
  return texto.length > 8 ? `${texto.slice(0, 8)}...` : texto;
}

function getAppointmentStatus(status) {
  const statuses = {
    agendado: {
      label: "Programado",
      key: "confirmed",
    },
    cancelado: {
      label: "Cancelado",
      key: "cancelled",
    },
    nao_compareceu: {
      label: "Não compareceu",
      key: "noshow",
    },
    concluido: {
      label: "Concluído",
      key: "completed",
    },
    concluída: {
      label: "Concluído",
      key: "completed",
    },
    aguardando: {
      label: "Em espera",
      key: "waiting",
    },
  };

  return (
    statuses[String(status || "").toLowerCase()] || {
      label: status || "Programado",
      key: "confirmed",
    }
  );
}

export default function Agenda() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [pacientesMap, setPacientesMap] = useState({});
  const [pacientesLista, setPacientesLista] = useState([]);
  const [profissionaisLista, setProfissionaisLista] = useState([]);
  const [buscaPacienteForm, setBuscaPacienteForm] = useState("");
  const [buscandoPacientesServer, setBuscandoPacientesServer] = useState(false);
  const [buscaProfissionalForm, setBuscaProfissionalForm] = useState("");
  const [buscandoProfissionaisServer, setBuscandoProfissionaisServer] =
    useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [avisoExpirados, setAvisoExpirados] = useState("");
  const [formData, setFormData] = useState(initialFormData);

  const usuarioAtual = useMemo(() => {
    const token = obterToken();
    return token ? lerPayload(token) : null;
  }, []);

  async function carregarCatalogos() {
    const mapa = {};
    try {
      const respPac = await fetchComSessao(
        `${API_URL}/api/v1/pacientes?limit=100`
      );
      if (respPac.ok) {
        const dadosPac = await respPac.json();
        const lista = Array.isArray(dadosPac)
          ? dadosPac
          : Array.isArray(dadosPac?.items)
            ? dadosPac.items
            : [];
        setPacientesLista(lista.filter((p) => p?.ativo !== false));
        for (const p of lista) {
          indexarPaciente(mapa, p);
        }
        setPacientesMap((prev) => ({ ...prev, ...mapa }));
      }
    } catch {
      /* fallback para entrada manual de UUID se pacientes-service estiver offline */
    }

    try {
      const dadosProf = await listarProfissionais({ ativo: true });
      const listaProf = (Array.isArray(dadosProf) ? dadosProf : []).map(
        (prof, idx) => ({
          ...prof,
          uuid: resolverUuidProfissional(prof, idx, usuarioAtual),
        })
      );
      setProfissionaisLista(listaProf);
    } catch {
      /* fallback se profissionais-service estiver offline */
    }

    return mapa;
  }

  async function carregarPacientesPorIds(ids, mapaExistente = {}) {
    const faltantes = [
      ...new Set(
        ids
          .map((id) => String(id || "").trim())
          .filter(
            (id) => UUID_REGEX.test(id) && !mapaExistente[id.toLowerCase()]
          )
      ),
    ];

    if (faltantes.length === 0) return;

    const encontrados = await Promise.all(
      faltantes.map(async (pid) => {
        try {
          const resp = await fetchComSessao(
            `${API_URL}/api/v1/pacientes/${pid}`
          );
          if (!resp.ok) return null;
          return await resp.json();
        } catch {
          return null;
        }
      })
    );

    const extras = {};
    for (const pac of encontrados) {
      if (pac) indexarPaciente(extras, pac);
    }
    if (Object.keys(extras).length > 0) {
      setPacientesMap((prev) => ({ ...prev, ...extras }));
    }
  }

  async function loadAppointments() {
    setLoading(true);
    setError("");

    try {
      const response = await fetchComSessao(`${API_URL}/agendamentos`);

      if (response.status === 401) {
        throw new Error("Sua sessão expirou. Reconecte para continuar.");
      }
      if (!response.ok) {
        throw new Error("Não foi possível carregar os agendamentos.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("A API retornou um formato inesperado.");
      }

      // Verifica se alguma consulta de data anterior ficou pendente e cancela automaticamente
      const vencidosPendentes = data.filter(
        (apt) =>
          (apt.status === "agendado" || apt.status === "aguardando") &&
          ehAgendamentoDeDataPassada(apt.data_hora)
      );

      let listaNormalizada = data;
      if (vencidosPendentes.length > 0) {
        await Promise.all(
          vencidosPendentes.map((apt) =>
            fetchComSessao(`${API_URL}/agendamentos/${apt.id}/cancelar`, {
              method: "PATCH",
            }).catch(() => null)
          )
        );
        listaNormalizada = data.map((apt) =>
          (apt.status === "agendado" || apt.status === "aguardando") &&
          ehAgendamentoDeDataPassada(apt.data_hora)
            ? { ...apt, status: "cancelado", canceladoPorPrazo: true }
            : apt
        );
        const msg =
          vencidosPendentes.length === 1
            ? `1 consulta de data anterior (${formatDateShort(
                vencidosPendentes[0].data_hora
              )}) não foi iniciada no dia agendado, foi cancelada automaticamente e não pode ser retomada.`
            : `${vencidosPendentes.length} consultas de datas anteriores não foram iniciadas no dia agendado, foram canceladas automaticamente e não podem ser retomadas.`;
        setAvisoExpirados(msg);
      }

      setAppointments(listaNormalizada);
      return listaNormalizada;
    } catch (err) {
      setError(
        err.message ||
          "Erro ao carregar os agendamentos. Verifique a conexão."
      );
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ativo = true;
    async function inicializar() {
      const [mapaInicial, agendamentosCarregados] = await Promise.all([
        carregarCatalogos(),
        loadAppointments(),
      ]);
      if (!ativo || !Array.isArray(agendamentosCarregados)) return;
      await carregarPacientesPorIds(
        agendamentosCarregados.map((apt) => apt.paciente_id),
        mapaInicial
      );
    }
    inicializar();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const termo = buscaPacienteForm.trim();
    const timer = setTimeout(async () => {
      setBuscandoPacientesServer(true);
      try {
        const params = new URLSearchParams({
          ativo: "true",
          limit: "25",
          ...(termo ? { busca: termo } : {}),
        });
        const resp = await fetchComSessao(
          `${API_URL}/api/v1/pacientes?${params.toString()}`
        );
        if (resp.ok) {
          const dados = await resp.json();
          const lista = Array.isArray(dados)
            ? dados
            : Array.isArray(dados?.items)
              ? dados.items
              : [];
          const ativos = lista.filter((p) => p?.ativo !== false);
          setPacientesLista((prev) => {
            const porId = new Map();
            for (const item of [...ativos, ...prev]) {
              if (item?.id) porId.set(String(item.id), item);
            }
            return Array.from(porId.values());
          });
          const novoMapa = {};
          for (const p of lista) indexarPaciente(novoMapa, p);
          if (Object.keys(novoMapa).length > 0) {
            setPacientesMap((prev) => ({ ...prev, ...novoMapa }));
          }
        }
      } catch {
        /* mantém cache local */
      } finally {
        setBuscandoPacientesServer(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [buscaPacienteForm, showForm]);

  useEffect(() => {
    if (!showForm) return;
    const termo = buscaProfissionalForm.trim();
    if (!termo) return;
    const timer = setTimeout(async () => {
      setBuscandoProfissionaisServer(true);
      try {
        const dadosProf = await listarProfissionais({
          ativo: true,
          nome: termo,
        });
        const lista = Array.isArray(dadosProf) ? dadosProf : [];
        if (lista.length > 0) {
          setProfissionaisLista((prev) => {
            const existentes = [...prev];
            for (const prof of lista) {
              const jaExiste = existentes.some(
                (p) => String(p.id) === String(prof.id)
              );
              if (!jaExiste) {
                existentes.push({
                  ...prof,
                  uuid: resolverUuidProfissional(
                    prof,
                    existentes.length,
                    usuarioAtual
                  ),
                });
              }
            }
            return existentes;
          });
        }
      } catch {
        /* mantém cache local */
      } finally {
        setBuscandoProfissionaisServer(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [buscaProfissionalForm, showForm, usuarioAtual]);

  const opcoesPacientes = useMemo(() => {
    const termoNorm = normalizarTexto(buscaPacienteForm);
    const digitosBusca = buscaPacienteForm.replace(/\D/g, "");

    return pacientesLista
      .filter((pac) => {
        if (!termoNorm && !digitosBusca) return true;
        const nome = normalizarTexto(obterNomePaciente(pac));
        const cpf = String(pac?.cpf || "").replace(/\D/g, "");
        const email = normalizarTexto(pac?.email || "");
        return (
          (termoNorm && (nome.includes(termoNorm) || email.includes(termoNorm))) ||
          (digitosBusca && cpf.includes(digitosBusca))
        );
      })
      .sort((a, b) =>
        obterNomePaciente(a).localeCompare(obterNomePaciente(b), "pt-BR")
      )
      .slice(0, 25)
      .map((pac) => {
        const nome = obterNomePaciente(pac);
        const cpfFmt = formatarCpf(pac?.cpf);
        return {
          value: String(pac.id),
          label: nome,
          initials: initialsFromName(nome),
          badge: cpfFmt ? `CPF ${cpfFmt}` : "",
          subtitle: [
            cpfFmt ? `CPF: ${cpfFmt}` : null,
            pac?.telefone_principal || null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });
  }, [pacientesLista, buscaPacienteForm]);

  const pacienteSelecionadoOption = useMemo(() => {
    if (!formData.paciente_id) return null;
    const daLista = opcoesPacientes.find(
      (o) => String(o.value) === String(formData.paciente_id)
    );
    if (daLista) return daLista;
    const pac =
      pacientesMap[String(formData.paciente_id).toLowerCase()] ||
      pacientesLista.find((p) => String(p.id) === String(formData.paciente_id));
    if (!pac) return null;
    const nome = obterNomePaciente(pac);
    const cpfFmt = formatarCpf(pac?.cpf);
    return {
      value: String(pac.id),
      label: nome,
      initials: initialsFromName(nome),
      badge: cpfFmt ? `CPF ${cpfFmt}` : "",
    };
  }, [formData.paciente_id, opcoesPacientes, pacientesMap, pacientesLista]);

  const opcoesProfissionais = useMemo(() => {
    const termoNorm = normalizarTexto(buscaProfissionalForm);

    return profissionaisLista
      .filter((prof) => {
        if (!termoNorm) return true;
        const nome = normalizarTexto(prof?.nome);
        const doc = normalizarTexto(prof?.documento_registro);
        const esps = Array.isArray(prof?.especialidades)
          ? prof.especialidades
              .map((e) => normalizarTexto(e?.nome))
              .join(" ")
          : "";
        return (
          nome.includes(termoNorm) ||
          doc.includes(termoNorm) ||
          esps.includes(termoNorm)
        );
      })
      .slice(0, 25)
      .map((prof) => {
        const valorUuid = prof.uuid || String(prof.id);
        const espNome = prof?.especialidades?.[0]?.nome || null;
        return {
          value: valorUuid,
          label: prof.nome,
          initials: initialsFromName(prof.nome),
          badge: espNome || prof.documento_registro || "",
          subtitle: [
            espNome,
            prof.documento_registro ? `Reg.: ${prof.documento_registro}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });
  }, [profissionaisLista, buscaProfissionalForm]);

  const profissionalSelecionadoOption = useMemo(() => {
    if (!formData.profissional_id) return null;
    const daLista = opcoesProfissionais.find(
      (o) => String(o.value) === String(formData.profissional_id)
    );
    if (daLista) return daLista;
    const prof = profissionaisLista.find(
      (p) =>
        String(p.uuid || p.id) === String(formData.profissional_id)
    );
    if (!prof) return null;
    return {
      value: prof.uuid || String(prof.id),
      label: prof.nome,
      initials: initialsFromName(prof.nome),
      badge: prof?.especialidades?.[0]?.nome || prof.documento_registro || "",
    };
  }, [formData.profissional_id, opcoesProfissionais, profissionaisLista]);

  const profissionaisMap = useMemo(() => {
    const mapa = {};
    for (const prof of profissionaisLista) {
      if (prof?.id) mapa[String(prof.id).toLowerCase()] = prof;
      if (prof?.uuid) mapa[String(prof.uuid).toLowerCase()] = prof;
    }
    return mapa;
  }, [profissionaisLista]);

  const enrichedAppointments = useMemo(() => {
    return appointments.map((apt) => {
      const dataPassada = ehAgendamentoDeDataPassada(apt.data_hora);
      const statusNormalizado =
        dataPassada &&
        (apt.status === "agendado" || apt.status === "aguardando")
          ? "cancelado"
          : apt.status;
      const statusInfo = getAppointmentStatus(statusNormalizado);
      const pac = pacientesMap[String(apt.paciente_id || "").toLowerCase()];
      const prof =
        profissionaisMap[String(apt.profissional_id || "").toLowerCase()];
      const especialidadeProf =
        prof?.especialidades?.[0]?.nome || "Atendimento Clínico";
      const isTeleconsulta = apt.modalidade === "teleconsulta";
      const nomePaciente = obterNomePaciente(pac);

      return {
        ...apt,
        status: statusNormalizado,
        dataPassada,
        statusInfo,
        isTeleconsulta,
        pacienteInfo: {
          nome: nomePaciente || "Paciente cadastrado",
          iniciais: nomePaciente ? initialsFromName(nomePaciente) : "PC",
          especialidade: especialidadeProf,
          profissionalNome: prof?.nome || null,
          modalidadeLabel: isTeleconsulta ? "Teleconsulta" : "Presencial",
        },
      };
    });
  }, [appointments, pacientesMap, profissionaisMap]);

  const visibleAppointments = useMemo(() => {
    const search = query.trim().toLowerCase();

    return enrichedAppointments.filter((appointment) => {
      const { statusInfo, pacienteInfo } = appointment;

      const matchesSearch =
        !search ||
        pacienteInfo.nome.toLowerCase().includes(search) ||
        pacienteInfo.especialidade.toLowerCase().includes(search) ||
        pacienteInfo.modalidadeLabel.toLowerCase().includes(search) ||
        statusInfo.label.toLowerCase().includes(search);

      const isPending =
        statusInfo.key === "confirmed" || statusInfo.key === "waiting";
      const isCancelledOrNoShow =
        statusInfo.key === "cancelled" || statusInfo.key === "noshow";

      const matchesFilter =
        filter === "Todas" ||
        (filter === "Pendentes" && isPending) ||
        (filter === "Concluídas" && statusInfo.key === "completed") ||
        (filter === "Canceladas" && isCancelledOrNoShow);

      return matchesSearch && matchesFilter;
    }).sort((a, b) => {
      const diffHorario =
        minutosDoDiaLocal(a.data_hora) - minutosDoDiaLocal(b.data_hora);
      if (diffHorario !== 0) return diffHorario;
      return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
    });
  }, [enrichedAppointments, query, filter]);

  const stats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let cancelled = 0;

    for (const apt of enrichedAppointments) {
      if (apt.statusInfo.key === "completed") completed += 1;
      else if (
        apt.statusInfo.key === "cancelled" ||
        apt.statusInfo.key === "noshow"
      )
        cancelled += 1;
      else pending += 1;
    }

    const activeTotal = pending + completed;
    const progressPercent =
      activeTotal > 0 ? Math.round((completed / activeTotal) * 100) : 0;

    return {
      total: enrichedAppointments.length,
      pending,
      completed,
      cancelled,
      progressPercent,
    };
  }, [enrichedAppointments]);

  function handleNewAppointment() {
    const defaultProfId =
      profissionaisLista[0]?.uuid
        ? String(profissionaisLista[0].uuid)
        : usuarioAtual?.perfil === "PROFISSIONAL" && usuarioAtual?.sub
          ? String(usuarioAtual.sub)
          : PROFISSIONAL_UUID_PADRAO;

    setFormData({
      ...initialFormData,
      profissional_id: defaultProfId,
    });
    setShowForm((prev) => !prev);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === "modalidade" && value === "presencial"
        ? { link_teleconsulta: "" }
        : {}),
    }));
  }

  async function handleSubmitAppointment(event) {
    event.preventDefault();
    if (saving) return;

    const pacienteId = formData.paciente_id.trim();
    const profissionalId = formData.profissional_id.trim();
    const duracao = Number(formData.duracao_minutos);

    if (!UUID_REGEX.test(pacienteId) || !UUID_REGEX.test(profissionalId)) {
      showToast("Selecione ou informe UUIDs válidos para paciente e profissional.");
      return;
    }

    if (!formData.data || !formData.horario) {
      showToast("Preencha a data e o horário da consulta.");
      return;
    }

    const dataHora = new Date(`${formData.data}T${formData.horario}:00`);

    if (Number.isNaN(dataHora.getTime())) {
      showToast("Informe uma data e um horário válidos.");
      return;
    }

    const linkLimpo = formData.link_teleconsulta.trim();
    if (
      formData.modalidade === "teleconsulta" &&
      linkLimpo &&
      !(linkLimpo.startsWith("https://") || linkLimpo.startsWith("http://"))
    ) {
      showToast("O link da teleconsulta deve começar com http:// ou https://.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        paciente_id: pacienteId,
        profissional_id: profissionalId,
        data_hora: dataHora.toISOString(),
        duracao_minutos: duracao,
        modalidade: formData.modalidade,
        ...(formData.modalidade === "teleconsulta" && linkLimpo
          ? { link_teleconsulta: linkLimpo }
          : {}),
      };

      const response = await fetchComSessao(`${API_URL}/agendamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail
                  .map((item) => item.msg)
                  .filter(Boolean)
                  .join(" ")
              : "";

        throw new Error(detail || "Não foi possível cadastrar o agendamento.");
      }

      setAppointments((current) => [...current, data]);
      carregarPacientesPorIds([data.paciente_id], pacientesMap);
      setShowForm(false);
      setFormData({ ...initialFormData });
      showToast(
        data.modalidade === "teleconsulta"
          ? "Teleconsulta agendada com sucesso!"
          : "Consulta agendada com sucesso!"
      );
    } catch (err) {
      showToast(err.message || "Erro ao cadastrar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSalvarLinkTeleconsulta(appointment) {
    const url = linkDraft.trim();
    if (!(url.startsWith("https://") || url.startsWith("http://"))) {
      showToast("Informe uma URL válida começando com https://");
      return;
    }

    setBusyActionId(appointment.id);
    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/teleconsulta`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ link_teleconsulta: url }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Não foi possível salvar o link da teleconsulta."
        );
      }

      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? data : item))
      );
      setEditingLinkId(null);
      setLinkDraft("");
      showToast("Link da teleconsulta salvo!");
    } catch (err) {
      showToast(err.message || "Erro ao salvar link da teleconsulta.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleCancelarConsulta(appointment) {
    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);

    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/cancelar`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível cancelar a consulta."
        );
      }

      const atualizado = await response.json();
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id ? atualizado : item
        )
      );
      showToast("Consulta cancelada.");
    } catch (err) {
      showToast(err.message || "Erro ao cancelar a consulta.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleRetomarConsulta(appointment) {
    if (ehAgendamentoDeDataPassada(appointment.data_hora)) {
      const msg = `A consulta de ${appointment.pacienteInfo.nome} (${formatDateShort(
        appointment.data_hora
      )}) é de uma data passada, foi cancelada por não ter sido realizada no dia e não pode ser retomada.`;
      setAvisoExpirados(msg);
      return;
    }

    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);

    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/reativar`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível reativar a consulta."
        );
      }

      const atualizado = await response.json();
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id ? atualizado : item
        )
      );
      showToast(
        `Consulta de ${appointment.pacienteInfo.nome} retomada para a programação.`
      );
    } catch (err) {
      showToast(err.message || "Erro ao reativar a consulta.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleConcluirConsulta(appointment) {
    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);

    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/concluir`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível concluir a consulta."
        );
      }

      const atualizado = await response.json();
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id ? atualizado : item
        )
      );
      showToast(
        `Atendimento de ${appointment.pacienteInfo.nome} marcado como concluído.`
      );
    } catch (err) {
      showToast(err.message || "Erro ao concluir o atendimento.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleNaoCompareceu(appointment) {
    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);

    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/nao-compareceu`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível registrar ausência."
        );
      }

      const atualizado = await response.json();
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id ? atualizado : item
        )
      );
      showToast(`Ausência registrada para ${appointment.pacienteInfo.nome}.`);
    } catch (err) {
      showToast(err.message || "Erro ao registrar ausência.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleReabrirConsulta(appointment) {
    if (ehAgendamentoDeDataPassada(appointment.data_hora)) {
      const msg = `O atendimento de ${appointment.pacienteInfo.nome} (${formatDateShort(
        appointment.data_hora
      )}) pertence a uma data passada e não pode ser reaberto para a fila de próximos.`;
      setAvisoExpirados(msg);
      return;
    }

    if (busyActionId === appointment.id) return;
    setBusyActionId(appointment.id);

    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}/reativar`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível reabrir a consulta."
        );
      }

      const atualizado = await response.json();
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id ? atualizado : item
        )
      );
      showToast(
        `Atendimento de ${appointment.pacienteInfo.nome} reaberto e retornado para Próximos.`
      );
    } catch (err) {
      showToast(err.message || "Erro ao reabrir a consulta.");
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleExcluirConsulta(appointment) {
    if (ehAgendamentoDeDataPassada(appointment.data_hora)) {
      const msg = `O registro de ${appointment.pacienteInfo.nome} (${formatDateShort(
        appointment.data_hora
      )}) pertence a uma data passada e não pode ser excluído do histórico.`;
      setAvisoExpirados(msg);
      return;
    }

    if (busyActionId === appointment.id) return;
    const confirmou = window.confirm(
      `Deseja realmente excluir o agendamento de ${appointment.pacienteInfo.nome}? Essa ação não poderá ser desfeita.`
    );
    if (!confirmou) return;

    setBusyActionId(appointment.id);

    try {
      const response = await fetchComSessao(
        `${API_URL}/agendamentos/${appointment.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || "Não foi possível excluir a consulta."
        );
      }

      setAppointments((current) =>
        current.filter((item) => item.id !== appointment.id)
      );
      showToast(`Agendamento de ${appointment.pacienteInfo.nome} excluído.`);
    } catch (err) {
      showToast(err.message || "Erro ao excluir a consulta.");
    } finally {
      setBusyActionId(null);
    }
  }

  function iniciarConsulta(pacienteId) {
    navigate(`/prontuario/${pacienteId}`);
  }

  return (
    <div className="doctor-agenda-workspace">
      {/* COLUNA ESQUERDA: RESUMO DO EXPEDIENTE E BOTÃO EM DESTAQUE */}
      <aside className="doctor-agenda-sidebar">
        <section className="card doctor-cta-schedule-card">
          <div className="doctor-cta-schedule-top">
            <span className="doctor-cta-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="14" x2="12" y2="18" />
                <line x1="10" y1="16" x2="14" y2="16" />
              </svg>
            </span>
            <div>
              <strong>Agendar consulta</strong>
              <small>Marque atendimento presencial ou teleconsulta</small>
            </div>
          </div>

          <Btn
            variant={showForm ? "secondary" : "primary"}
            className="btn-block doctor-cta-schedule-btn"
            onClick={handleNewAppointment}
          >
            {showForm ? "✕ Fechar formulário" : "＋ Marcar nova consulta"}
          </Btn>
        </section>

        <section className="card doctor-day-panel">
          <header className="doctor-day-panel-head">
            <div>
              <span className="doctor-day-eyebrow">ACOMPANHAMENTO DIÁRIO</span>
              <h2 className="card-title">Resumo do expediente</h2>
            </div>
            <span className="doctor-progress-pill">
              {stats.progressPercent}% concluído
            </span>
          </header>

          <div
            className="doctor-progress-track"
            role="progressbar"
            aria-valuenow={stats.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="doctor-progress-fill"
              style={{ width: `${stats.progressPercent}%` }}
            />
          </div>

          <div className="doctor-kpi-stack">
            <button
              type="button"
              className={`doctor-kpi-item doctor-kpi-pending ${
                filter === "Pendentes" ? "doctor-kpi-item-selected" : ""
              }`}
              onClick={() =>
                setFilter(filter === "Pendentes" ? "Todas" : "Pendentes")
              }
            >
              <span className="doctor-kpi-icon" aria-hidden="true">
                ◷
              </span>
              <div className="doctor-kpi-copy">
                <strong>Próximos atendimentos</strong>
                <small>Consultas aguardando início</small>
              </div>
              <span className="doctor-kpi-number">
                {String(stats.pending).padStart(2, "0")}
              </span>
            </button>

            <button
              type="button"
              className={`doctor-kpi-item doctor-kpi-done ${
                filter === "Concluídas" ? "doctor-kpi-item-selected" : ""
              }`}
              onClick={() =>
                setFilter(filter === "Concluídas" ? "Todas" : "Concluídas")
              }
            >
              <span className="doctor-kpi-icon" aria-hidden="true">
                ✓
              </span>
              <div className="doctor-kpi-copy">
                <strong>Concluídos</strong>
                <small>Atendimentos finalizados</small>
              </div>
              <span className="doctor-kpi-number">
                {String(stats.completed).padStart(2, "0")}
              </span>
            </button>

            <button
              type="button"
              className={`doctor-kpi-item doctor-kpi-cancelled ${
                filter === "Canceladas" ? "doctor-kpi-item-selected" : ""
              }`}
              onClick={() =>
                setFilter(filter === "Canceladas" ? "Todas" : "Canceladas")
              }
            >
              <span className="doctor-kpi-icon" aria-hidden="true">
                ✕
              </span>
              <div className="doctor-kpi-copy">
                <strong>Cancelados / Faltas</strong>
                <small>Desmarcados ou não compareceu</small>
              </div>
              <span className="doctor-kpi-number">
                {String(stats.cancelled).padStart(2, "0")}
              </span>
            </button>
          </div>

          <div className="doctor-day-total-bar">
            <span>Total programado na agenda</span>
            <strong>{stats.total} consulta(s)</strong>
          </div>
        </section>
      </aside>

      {/* COLUNA DIREITA (PRINCIPAL): PROGRAMAÇÃO VERTICAL DE PACIENTES */}
      <div className="doctor-agenda-main">
        {showForm && (
          <Card
            title="Agendar nova consulta"
            description="Selecione o paciente, profissional, modalidade e horário."
          >
            <form
              className="doctor-new-appointment-form"
              onSubmit={handleSubmitAppointment}
            >
              <div className="patient-grid patient-grid-personal">
                <SearchableCombobox
                  id="agenda-select-paciente"
                  label="Paciente"
                  placeholder="Pesquisar paciente por nome ou CPF..."
                  value={formData.paciente_id}
                  options={opcoesPacientes}
                  selectedOption={pacienteSelecionadoOption}
                  searching={buscandoPacientesServer}
                  hintText="Busque por nome ou CPF"
                  emptyMessage="Nenhum paciente encontrado com esse termo."
                  onSearchChange={setBuscaPacienteForm}
                  onSelect={(val) =>
                    setFormData((curr) => ({ ...curr, paciente_id: val }))
                  }
                />

                <SearchableCombobox
                  id="agenda-select-profissional"
                  label="Profissional"
                  placeholder="Pesquisar por nome, registro ou especialidade..."
                  value={formData.profissional_id}
                  options={opcoesProfissionais}
                  selectedOption={profissionalSelecionadoOption}
                  searching={buscandoProfissionaisServer}
                  hintText="Nome, CRM/CRFa ou especialidade"
                  emptyMessage="Nenhum profissional encontrado com esse termo."
                  onSearchChange={setBuscaProfissionalForm}
                  onSelect={(val) =>
                    setFormData((curr) => ({ ...curr, profissional_id: val }))
                  }
                />

                <label className="patient-field">
                  <span>Modalidade</span>
                  <select
                    name="modalidade"
                    value={formData.modalidade}
                    onChange={handleFormChange}
                  >
                    <option value="presencial">Presencial</option>
                    <option value="teleconsulta">Teleconsulta (Online)</option>
                  </select>
                </label>

                <label className="patient-field">
                  <span>Data</span>
                  <input
                    type="date"
                    name="data"
                    value={formData.data}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label className="patient-field">
                  <span>Horário</span>
                  <input
                    type="time"
                    name="horario"
                    value={formData.horario}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label className="patient-field">
                  <span>Duração</span>
                  <select
                    name="duracao_minutos"
                    value={formData.duracao_minutos}
                    onChange={handleFormChange}
                  >
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="40">40 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">60 minutos</option>
                  </select>
                </label>

                {formData.modalidade === "teleconsulta" && (
                  <label className="patient-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Link da sala virtual (Google Meet / videoconferência — opcional agora)</span>
                    <input
                      type="url"
                      name="link_teleconsulta"
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      value={formData.link_teleconsulta}
                      onChange={handleFormChange}
                    />
                  </label>
                )}
              </div>

              <div className="patient-form-footer">
                <span />
                <div className="patient-form-buttons">
                  <Btn
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Btn>

                  <Btn type="submit" size="sm" disabled={saving}>
                    {saving ? "Salvando..." : "Confirmar agendamento"}
                  </Btn>
                </div>
              </div>
            </form>
          </Card>
        )}

        <section className="card doctor-schedule-board">
          <header className="doctor-schedule-board-header">
            <div className="doctor-schedule-title-row">
              <div>
                <h2 className="card-title">Programação de Pacientes</h2>
                <p className="doctor-schedule-subtitle">
                  Pacientes agendados para atendimento presencial e teleconsulta
                </p>
              </div>

              <span className="records-count-badge">
                {visibleAppointments.length} atendimento(s)
              </span>
            </div>

            <div className="doctor-schedule-controls">
              <div
                className="records-specialty-pills"
                role="tablist"
                aria-label="Filtrar fila de atendimento"
              >
                {FILTROS_AGENDA.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`records-filter-pill ${
                      filter === item.id ? "records-filter-pill-active" : ""
                    }`}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="search-field doctor-schedule-search">
                <span className="search-symbol" aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="search"
                  aria-label="Buscar paciente na programação"
                  placeholder="Buscar paciente, modalidade ou especialidade..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
          </header>

          {avisoExpirados && (
            <div className="doctor-expired-alert" role="alert">
              <div className="doctor-expired-alert-content">
                <span className="doctor-expired-alert-icon" aria-hidden="true">
                  ⚠
                </span>
                <div>
                  <strong>Consulta encerrada por prazo expirado</strong>
                  <p>{avisoExpirados}</p>
                </div>
              </div>
              <button
                type="button"
                className="doctor-expired-alert-close"
                aria-label="Fechar aviso"
                onClick={() => setAvisoExpirados("")}
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <strong>Carregando fila de atendimento...</strong>
            </div>
          ) : error ? (
            <div className="empty-state">
              <strong>Não foi possível carregar a programação</strong>
              <p>{error}</p>
              <Btn variant="secondary" onClick={loadAppointments}>
                Tentar novamente
              </Btn>
            </div>
          ) : visibleAppointments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">⌕</span>
              <strong>Nenhum paciente nesta visualização</strong>
              <p>
                Não há atendimentos correspondentes ao filtro selecionado no
                momento.
              </p>
              {(query || filter !== "Todas") && (
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFilter("Todas");
                  }}
                >
                  Mostrar todos os agendamentos
                </Btn>
              )}
            </div>
          ) : (
            <div className="doctor-patient-stack">
              {visibleAppointments.map((appointment) => {
                const { statusInfo, pacienteInfo, isTeleconsulta } = appointment;
                const isPending =
                  statusInfo.key === "confirmed" ||
                  statusInfo.key === "waiting";
                const isCompleted = statusInfo.key === "completed";
                const isCancelled =
                  statusInfo.key === "cancelled" ||
                  statusInfo.key === "noshow";

                return (
                  <article
                    key={appointment.id}
                    className={`doctor-patient-card doctor-patient-card-${statusInfo.key}`}
                  >
                    <div className="doctor-patient-time-box">
                      <strong className="doctor-patient-hour">
                        {formatTime(appointment.data_hora)}
                      </strong>
                      <span className="doctor-patient-duration">
                        {appointment.duracao_minutos} min
                      </span>
                      <small className="doctor-patient-date">
                        {formatDateShort(appointment.data_hora)}
                      </small>
                    </div>

                    <div className="doctor-patient-main">
                      <div
                        className="patient-avatar doctor-uniform-avatar"
                        aria-hidden="true"
                      >
                        {pacienteInfo.iniciais}
                      </div>

                      <div className="doctor-patient-details">
                        <div className="doctor-patient-top-row">
                          <h3 className="doctor-patient-name">
                            {pacienteInfo.nome}
                          </h3>
                          <span
                            className={`status-pill status-${statusInfo.key}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="doctor-patient-badges">
                          <span className="patient-record-badge patient-record-badge-specialty">
                            {pacienteInfo.especialidade}
                          </span>
                          <span
                            className={`patient-record-badge ${
                              isTeleconsulta
                                ? "patient-record-badge-remote"
                                : "patient-record-badge-presential"
                            }`}
                          >
                            {pacienteInfo.modalidadeLabel}
                          </span>
                          {pacienteInfo.profissionalNome && (
                            <span className="patient-record-badge">
                              Dr(a). {pacienteInfo.profissionalNome}
                            </span>
                          )}
                        </div>

                        {isTeleconsulta && editingLinkId === appointment.id && (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              type="url"
                              placeholder="https://meet.google.com/xxx-xxxx-xxx"
                              value={linkDraft}
                              onChange={(e) => setLinkDraft(e.target.value)}
                              style={{ flex: 1, minWidth: "220px" }}
                            />
                            <Btn
                              size="sm"
                              disabled={busyActionId === appointment.id}
                              onClick={() =>
                                handleSalvarLinkTeleconsulta(appointment)
                              }
                            >
                              Salvar link
                            </Btn>
                            <Btn
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingLinkId(null);
                                setLinkDraft("");
                              }}
                            >
                              Cancelar
                            </Btn>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="doctor-patient-actions">
                      {isPending && (
                        <>
                          {isTeleconsulta && appointment.link_teleconsulta && (
                            <a
                              href={appointment.link_teleconsulta}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="doctor-action-btn"
                              title="Abrir sala virtual de teleconsulta"
                            >
                              📹 Entrar na sala
                            </a>
                          )}

                          {isTeleconsulta && editingLinkId !== appointment.id && (
                            <button
                              type="button"
                              className="doctor-action-btn"
                              onClick={() => {
                                setEditingLinkId(appointment.id);
                                setLinkDraft(appointment.link_teleconsulta || "");
                              }}
                              title="Configurar URL do Google Meet"
                            >
                              🔗 {appointment.link_teleconsulta ? "Editar link" : "Adicionar link"}
                            </button>
                          )}

                          <Btn
                            size="sm"
                            onClick={() =>
                              iniciarConsulta(appointment.paciente_id)
                            }
                          >
                            ▶ Iniciar consulta
                          </Btn>

                          <button
                            type="button"
                            className="doctor-action-btn doctor-action-complete"
                            disabled={busyActionId === appointment.id}
                            onClick={() =>
                              handleConcluirConsulta(appointment)
                            }
                            title="Marcar atendimento como realizado"
                          >
                            ✓ Concluir
                          </button>

                          <button
                            type="button"
                            className="doctor-action-btn"
                            disabled={busyActionId === appointment.id}
                            onClick={() =>
                              handleNaoCompareceu(appointment)
                            }
                            title="Registrar que o paciente não compareceu"
                          >
                            ⊘ Faltou
                          </button>

                          <button
                            type="button"
                            className="doctor-action-btn doctor-action-cancel"
                            disabled={busyActionId === appointment.id}
                            onClick={() =>
                              handleCancelarConsulta(appointment)
                            }
                            title="Cancelar agendamento"
                          >
                            ✕ Cancelar
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <>
                          <Btn
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              iniciarConsulta(appointment.paciente_id)
                            }
                          >
                            Abrir prontuário →
                          </Btn>

                          {!appointment.dataPassada && (
                            <>
                              <button
                                type="button"
                                className="doctor-action-btn doctor-action-reopen"
                                disabled={busyActionId === appointment.id}
                                onClick={() =>
                                  handleReabrirConsulta(appointment)
                                }
                                title="Reverter conclusão e retornar consulta para Próximos"
                              >
                                ↺ Reabrir
                              </button>

                              <button
                                type="button"
                                className="doctor-action-btn doctor-action-delete"
                                disabled={busyActionId === appointment.id}
                                onClick={() =>
                                  handleExcluirConsulta(appointment)
                                }
                                title="Excluir agendamento"
                              >
                                ✕ Excluir
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {isCancelled && (
                        <>
                          {appointment.dataPassada ? (
                            <button
                              type="button"
                              className="doctor-action-btn doctor-action-expired-lock"
                              onClick={() => handleRetomarConsulta(appointment)}
                              title="Consultas de datas passadas não podem ser retomadas"
                            >
                              ⊘ Prazo encerrado
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="doctor-action-btn doctor-action-resume"
                                disabled={busyActionId === appointment.id}
                                onClick={() =>
                                  handleRetomarConsulta(appointment)
                                }
                                title="Retomar consulta cancelada"
                              >
                                ↺ Retomar consulta
                              </button>

                              <button
                                type="button"
                                className="doctor-action-btn doctor-action-delete"
                                disabled={busyActionId === appointment.id}
                                onClick={() =>
                                  handleExcluirConsulta(appointment)
                                }
                                title="Excluir agendamento"
                              >
                                ✕ Excluir
                              </button>
                            </>
                          )}

                          <Btn
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              iniciarConsulta(appointment.paciente_id)
                            }
                          >
                            Ver prontuário
                          </Btn>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}