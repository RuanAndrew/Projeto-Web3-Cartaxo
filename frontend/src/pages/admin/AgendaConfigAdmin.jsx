import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Btn from "../../components/Btn.jsx";
import SearchableCombobox, {
  gerarSlotsComerciais,
  iniciaisDeNome,
  normalizarTextoBusca,
} from "../../components/SearchableCombobox.jsx";
import { useToast } from "../../components/ToastProvider.jsx";
import {
  DIAS_SEMANA,
  adicionarDisponibilidade,
  buscarHorariosDisponiveis,
  diaSemanaDeData,
  formatDataBR,
  formatDataExtenso,
  formatHora,
  hojeIso,
  listarDisponibilidades,
  listarEspecialidades,
  listarProfissionais,
  proximaDataParaDiaSemana,
  removerDisponibilidade,
  somarDiasIso,
} from "../../services/profissionaisApi.js";
import {
  garantirSessaoValida,
  obterToken,
  removerToken,
} from "../../utils/auth.js";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFISSIONAL_UUID_PADRAO = "119d0caf-2b76-4782-85a5-65937af47356";

const LABEL_POR_DIA = Object.fromEntries(
  DIAS_SEMANA.map((d) => [d.value, d.label])
);

function resolverUuidProfissional(prof, index = 0) {
  const idStr = String(prof?.id || "").trim();
  if (UUID_REGEX.test(idStr)) return idStr;
  if (index === 0) return PROFISSIONAL_UUID_PADRAO;
  const sufixo =
    idStr.replace(/\D/g, "").padStart(12, "0").slice(-12) ||
    String(index + 1).padStart(12, "0");
  return `00000000-0000-4000-8000-${sufixo}`;
}

function obterNomePaciente(pac) {
  return String(pac?.nome_completo || pac?.nome || "").trim();
}

function formatarCpf(cpf = "") {
  const digitos = String(cpf || "").replace(/\D/g, "");
  if (digitos.length !== 11) return "";
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function horarioParaMinutos(horaStr = "") {
  const [h, m] = String(horaStr).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function extrairDataLocalIso(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function extrairHoraLocal(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

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

export default function AgendaConfigAdmin() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profissionais, setProfissionais] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [pacientesLista, setPacientesLista] = useState([]);
  const [pacientesMap, setPacientesMap] = useState({});
  const [agendamentosClinica, setAgendamentosClinica] = useState([]);

  const [profissionalId, setProfissionalId] = useState(
    searchParams.get("profissional") || ""
  );
  const [pacienteId, setPacienteId] = useState("");
  const [modalidade, setModalidade] = useState("presencial");

  // Busca de profissionais e pacientes para 10.000+ registros
  const [termoBuscaProfForm, setTermoBuscaProfForm] = useState("");
  const [buscandoProfFormServer, setBuscandoProfFormServer] = useState(false);
  const [termoBuscaPacienteForm, setTermoBuscaPacienteForm] = useState("");
  const [buscandoPacienteServer, setBuscandoPacienteServer] = useState(false);
  const [termoBuscaProfFiltro, setTermoBuscaProfFiltro] = useState("");
  const [buscandoProfFiltroServer, setBuscandoProfFiltroServer] =
    useState(false);

  // Disponibilidades do profissional selecionado (UC07)
  const [disponibilidades, setDisponibilidades] = useState([]);

  // Formulário de horário com duração fixa (15 ou 20 min) no horário comercial (08:00–17:00)
  const dataInicial = useMemo(() => hojeIso(), []);
  const [dataAtendimento, setDataAtendimento] = useState(dataInicial);
  const [diaSemana, setDiaSemana] = useState(() =>
    diaSemanaDeData(dataInicial)
  );
  const [duracaoMinutos, setDuracaoMinutos] = useState(15);
  const [slotsSelecionados, setSlotsSelecionados] = useState(["08:00-08:15"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Consulta de horários disponíveis (UC08)
  const [buscaProfissionalId, setBuscaProfissionalId] = useState("");
  const [buscaEspecialidadeId, setBuscaEspecialidadeId] = useState("");
  const [buscaDia, setBuscaDia] = useState("");
  const [buscaData, setBuscaData] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [loadingBusca, setLoadingBusca] = useState(false);

  const carregarPacientesIniciais = useCallback(async () => {
    try {
      const resp = await fetchComSessao(
        `${API_URL}/api/v1/pacientes?ativo=true&limit=100`
      );
      if (!resp.ok) return;
      const dados = await resp.json();
      const lista = Array.isArray(dados)
        ? dados
        : Array.isArray(dados?.items)
          ? dados.items
          : [];
      setPacientesLista(lista.filter((p) => p?.ativo !== false));
      const mapa = {};
      for (const p of lista) {
        if (p?.id) mapa[String(p.id).toLowerCase()] = p;
        if (p?.user_account_id)
          mapa[String(p.user_account_id).toLowerCase()] = p;
      }
      setPacientesMap((prev) => ({ ...prev, ...mapa }));
    } catch {
      /* ignora se offline */
    }
  }, []);

  const carregarAgendamentosClinica = useCallback(async () => {
    try {
      const resp = await fetchComSessao(`${API_URL}/agendamentos`);
      if (!resp.ok) return;
      const dados = await resp.json();
      if (Array.isArray(dados)) {
        setAgendamentosClinica(dados);
      }
    } catch {
      /* ignora se offline */
    }
  }, []);

  useEffect(() => {
    Promise.all([
      listarProfissionais(),
      listarEspecialidades(),
      carregarPacientesIniciais(),
      carregarAgendamentosClinica(),
    ])
      .then(([profs, esps]) => {
        const listaProfs = (Array.isArray(profs) ? profs : []).map(
          (p, idx) => ({
            ...p,
            uuid: resolverUuidProfissional(p, idx),
          })
        );
        setProfissionais(listaProfs);
        setEspecialidades(Array.isArray(esps) ? esps : []);
        if (!profissionalId && listaProfs.length > 0) {
          setProfissionalId(String(listaProfs[0].id));
        }
      })
      .catch((err) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca sob demanda de Pacientes no servidor (10.000+ pacientes por Nome ou CPF)
  useEffect(() => {
    const termo = termoBuscaPacienteForm.trim();
    const timer = setTimeout(async () => {
      setBuscandoPacienteServer(true);
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
          for (const p of lista) {
            if (p?.id) novoMapa[String(p.id).toLowerCase()] = p;
            if (p?.user_account_id)
              novoMapa[String(p.user_account_id).toLowerCase()] = p;
          }
          if (Object.keys(novoMapa).length > 0) {
            setPacientesMap((prev) => ({ ...prev, ...novoMapa }));
          }
        }
      } catch {
        /* mantém cache */
      } finally {
        setBuscandoPacienteServer(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [termoBuscaPacienteForm]);

  // Busca sob demanda de Profissionais no servidor (formulário)
  useEffect(() => {
    const termo = termoBuscaProfForm.trim();
    if (!termo) return;
    const timer = setTimeout(async () => {
      setBuscandoProfFormServer(true);
      try {
        const encontrados = await listarProfissionais({ nome: termo });
        if (Array.isArray(encontrados) && encontrados.length > 0) {
          setProfissionais((atuais) => {
            const existentes = [...atuais];
            for (const p of encontrados) {
              if (!existentes.some((item) => String(item.id) === String(p.id))) {
                existentes.push({
                  ...p,
                  uuid: resolverUuidProfissional(p, existentes.length),
                });
              }
            }
            return existentes;
          });
        }
      } catch {
        /* mantém lista em cache */
      } finally {
        setBuscandoProfFormServer(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [termoBuscaProfForm]);

  // Busca sob demanda de Profissionais no servidor (filtro UC08)
  useEffect(() => {
    const termo = termoBuscaProfFiltro.trim();
    if (!termo) return;
    const timer = setTimeout(async () => {
      setBuscandoProfFiltroServer(true);
      try {
        const encontrados = await listarProfissionais({
          nome: termo,
          ativo: true,
        });
        if (Array.isArray(encontrados) && encontrados.length > 0) {
          setProfissionais((atuais) => {
            const existentes = [...atuais];
            for (const p of encontrados) {
              if (!existentes.some((item) => String(item.id) === String(p.id))) {
                existentes.push({
                  ...p,
                  uuid: resolverUuidProfissional(p, existentes.length),
                });
              }
            }
            return existentes;
          });
        }
      } catch {
        /* mantém lista em cache */
      } finally {
        setBuscandoProfFiltroServer(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [termoBuscaProfFiltro]);

  const carregarAgenda = useCallback(async (id) => {
    if (!id) {
      setDisponibilidades([]);
      return;
    }
    try {
      const lista = await listarDisponibilidades(id);
      setDisponibilidades(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const executarBusca = useCallback(async () => {
    setLoadingBusca(true);
    try {
      const res = await buscarHorariosDisponiveis({
        profissional_id: buscaProfissionalId || undefined,
        especialidade_id: buscaEspecialidadeId || undefined,
        dia_semana: buscaDia || undefined,
        data_atendimento: buscaData || undefined,
      });
      setResultadosBusca(Array.isArray(res) ? res : []);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoadingBusca(false);
    }
  }, [
    buscaProfissionalId,
    buscaEspecialidadeId,
    buscaDia,
    buscaData,
    showToast,
  ]);

  useEffect(() => {
    carregarAgenda(profissionalId);
  }, [profissionalId, carregarAgenda]);

  useEffect(() => {
    executarBusca();
  }, [executarBusca]);

  const profissionalAtual = useMemo(() => {
    const idx = profissionais.findIndex(
      (p) => String(p.id) === String(profissionalId)
    );
    if (idx === -1) return null;
    const p = profissionais[idx];
    return {
      ...p,
      uuid: p.uuid || resolverUuidProfissional(p, idx),
    };
  }, [profissionais, profissionalId]);

  // Opções para combobox de Profissional
  const opcoesProfissionaisForm = useMemo(() => {
    const termo = normalizarTextoBusca(termoBuscaProfForm);
    return profissionais
      .filter((prof) => {
        if (!termo) return true;
        const nome = normalizarTextoBusca(prof.nome);
        const doc = normalizarTextoBusca(prof.documento_registro);
        const esps = (prof.especialidades || [])
          .map((e) => normalizarTextoBusca(e.nome))
          .join(" ");
        return (
          nome.includes(termo) || doc.includes(termo) || esps.includes(termo)
        );
      })
      .slice(0, 25)
      .map((prof) => {
        const espPrincipal = prof.especialidades?.[0]?.nome || "";
        return {
          value: String(prof.id),
          label: prof.nome,
          initials: iniciaisDeNome(prof.nome),
          badge: prof.ativo ? prof.documento_registro : "Inativo",
          subtitle: [
            espPrincipal,
            `Reg.: ${prof.documento_registro}`,
            !prof.ativo ? "Inativo" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });
  }, [profissionais, termoBuscaProfForm]);

  const profissionalFormSelecionado = useMemo(() => {
    if (!profissionalId) return null;
    return (
      opcoesProfissionaisForm.find(
        (o) => String(o.value) === String(profissionalId)
      ) ||
      (profissionalAtual
        ? {
            value: String(profissionalAtual.id),
            label: profissionalAtual.nome,
            initials: iniciaisDeNome(profissionalAtual.nome),
            badge: profissionalAtual.documento_registro,
          }
        : null)
    );
  }, [profissionalId, opcoesProfissionaisForm, profissionalAtual]);

  // Opções para combobox de Paciente (10.000+ pacientes por Nome ou CPF)
  const opcoesPacientesForm = useMemo(() => {
    const termo = normalizarTextoBusca(termoBuscaPacienteForm);
    const digitos = termoBuscaPacienteForm.replace(/\D/g, "");

    return pacientesLista
      .filter((pac) => {
        if (!termo && !digitos) return true;
        const nome = normalizarTextoBusca(obterNomePaciente(pac));
        const cpf = String(pac?.cpf || "").replace(/\D/g, "");
        const email = normalizarTextoBusca(pac?.email || "");
        return (
          (termo && (nome.includes(termo) || email.includes(termo))) ||
          (digitos && cpf.includes(digitos))
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
          initials: iniciaisDeNome(nome),
          badge: cpfFmt ? `CPF ${cpfFmt}` : "",
          subtitle: [
            cpfFmt ? `CPF: ${cpfFmt}` : null,
            pac?.telefone_principal || null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      });
  }, [pacientesLista, termoBuscaPacienteForm]);

  const pacienteFormSelecionado = useMemo(() => {
    if (!pacienteId) return null;
    const daOpcao = opcoesPacientesForm.find(
      (o) => String(o.value) === String(pacienteId)
    );
    if (daOpcao) return daOpcao;
    const pac =
      pacientesMap[String(pacienteId).toLowerCase()] ||
      pacientesLista.find((p) => String(p.id) === String(pacienteId));
    if (!pac) return null;
    const nome = obterNomePaciente(pac);
    const cpfFmt = formatarCpf(pac?.cpf);
    return {
      value: String(pac.id),
      label: nome,
      initials: iniciaisDeNome(nome),
      badge: cpfFmt ? `CPF ${cpfFmt}` : "",
    };
  }, [pacienteId, opcoesPacientesForm, pacientesMap, pacientesLista]);

  // Opções para combobox de Profissional Ativo (Filtro UC08)
  const opcoesProfissionaisFiltro = useMemo(() => {
    const termo = normalizarTextoBusca(termoBuscaProfFiltro);
    return profissionais
      .filter((p) => p.ativo)
      .filter((prof) => {
        if (!termo) return true;
        const nome = normalizarTextoBusca(prof.nome);
        const doc = normalizarTextoBusca(prof.documento_registro);
        const esps = (prof.especialidades || [])
          .map((e) => normalizarTextoBusca(e.nome))
          .join(" ");
        return (
          nome.includes(termo) || doc.includes(termo) || esps.includes(termo)
        );
      })
      .slice(0, 25)
      .map((prof) => {
        const espPrincipal = prof.especialidades?.[0]?.nome || "";
        return {
          value: String(prof.id),
          label: prof.nome,
          initials: iniciaisDeNome(prof.nome),
          badge: espPrincipal || prof.documento_registro,
          subtitle: [espPrincipal, `Reg.: ${prof.documento_registro}`]
            .filter(Boolean)
            .join(" · "),
        };
      });
  }, [profissionais, termoBuscaProfFiltro]);

  const profissionalFiltroSelecionado = useMemo(() => {
    if (!buscaProfissionalId) return null;
    return (
      opcoesProfissionaisFiltro.find(
        (o) => String(o.value) === String(buscaProfissionalId)
      ) || null
    );
  }, [buscaProfissionalId, opcoesProfissionaisFiltro]);

  // Slots comerciais (08:00 às 17:00) de 15 ou 20 min
  const catalogoSlotsComerciais = useMemo(
    () => gerarSlotsComerciais(duracaoMinutos),
    [duracaoMinutos]
  );

  // Consultas reais do médico (agendamento-service) para exibir na grade e sincronizar com a Agenda do Médico
  const agendamentosDoMedico = useMemo(() => {
    if (!profissionalAtual?.uuid) return [];
    const uuidAlvo = String(profissionalAtual.uuid).toLowerCase();
    return agendamentosClinica.filter(
      (apt) =>
        String(apt.profissional_id || "").toLowerCase() === uuidAlvo &&
        apt.status !== "cancelado" &&
        apt.status !== "nao_compareceu"
    );
  }, [agendamentosClinica, profissionalAtual]);

  // Verifica quais horários da data selecionada já possuem consulta marcada (agendamento-service) ou disponibilidade (ms-profissionais)
  const mapaSlotsOcupadosNoDia = useMemo(() => {
    const diaAlvo = dataAtendimento
      ? diaSemanaDeData(dataAtendimento)
      : diaSemana;

    const dispNoDia = disponibilidades.filter((slot) => {
      if (slot.dia_semana !== diaAlvo) return false;
      if (!dataAtendimento || !slot.data_atendimento) return true;
      return slot.data_atendimento === dataAtendimento;
    });

    const consultasNoDia = dataAtendimento
      ? agendamentosDoMedico.filter(
          (apt) => extrairDataLocalIso(apt.data_hora) === dataAtendimento
        )
      : [];

    const mapa = new Map();
    for (const item of catalogoSlotsComerciais) {
      const iniNovo = horarioParaMinutos(item.inicio);
      const fimNovo = horarioParaMinutos(item.fim);

      const consultaConflitante = consultasNoDia.find((apt) => {
        const horaIni = extrairHoraLocal(apt.data_hora);
        const iniExist = horarioParaMinutos(horaIni);
        const fimExist = iniExist + (Number(apt.duracao_minutos) || 30);
        return iniNovo < fimExist && fimNovo > iniExist;
      });

      const dispConflitante = dispNoDia.find((s) => {
        const iniExist = horarioParaMinutos(formatHora(s.horario_inicio));
        const fimExist = horarioParaMinutos(formatHora(s.horario_fim));
        return iniNovo < fimExist && fimNovo > iniExist;
      });

      if (consultaConflitante || dispConflitante) {
        const pac = consultaConflitante
          ? pacientesMap[
              String(consultaConflitante.paciente_id || "").toLowerCase()
            ]
          : null;
        mapa.set(item.key, {
          consulta: consultaConflitante || null,
          disponibilidade: dispConflitante || null,
          pacienteNome: obterNomePaciente(pac) || null,
        });
      }
    }
    return mapa;
  }, [
    catalogoSlotsComerciais,
    disponibilidades,
    agendamentosDoMedico,
    pacientesMap,
    dataAtendimento,
    diaSemana,
  ]);

  const slotsManha = useMemo(
    () => catalogoSlotsComerciais.filter((s) => s.turno === "MANHA"),
    [catalogoSlotsComerciais]
  );

  const slotsTarde = useMemo(
    () => catalogoSlotsComerciais.filter((s) => s.turno === "TARDE"),
    [catalogoSlotsComerciais]
  );

  function handleTrocarDuracao(novaDuracao) {
    setDuracaoMinutos(novaDuracao);
    const novosSlots = gerarSlotsComerciais(novaDuracao);
    const primeiroLivre =
      novosSlots.find((s) => !mapaSlotsOcupadosNoDia.has(s.key)) ||
      novosSlots[0];
    setSlotsSelecionados(primeiroLivre ? [primeiroLivre.key] : []);
  }

  function toggleSlotComercial(slotKey) {
    if (mapaSlotsOcupadosNoDia.has(slotKey)) return;
    setSlotsSelecionados((atuais) =>
      atuais.includes(slotKey)
        ? atuais.filter((k) => k !== slotKey)
        : [...atuais, slotKey]
    );
  }

  function selecionarTurnoLivre(turno) {
    const livres = catalogoSlotsComerciais
      .filter((s) => s.turno === turno && !mapaSlotsOcupadosNoDia.has(s.key))
      .map((s) => s.key);
    if (livres.length === 0) {
      showToast(
        "Todos os horários desse turno já estão preenchidos nesta data."
      );
      return;
    }
    setSlotsSelecionados((atuais) => {
      const todosJaSelecionados = livres.every((k) => atuais.includes(k));
      if (todosJaSelecionados) {
        return atuais.filter((k) => !livres.includes(k));
      }
      return Array.from(new Set([...atuais, ...livres]));
    });
  }

  function selecionarProfissional(novoId) {
    setProfissionalId(novoId);
    setSearchParams(novoId ? { profissional: novoId } : {});
    setError("");
  }

  function handleChangeDataAtendimento(novaData) {
    setDataAtendimento(novaData);
    if (novaData) {
      setDiaSemana(diaSemanaDeData(novaData));
    }
  }

  function handleSelectDiaSemana(novoDia) {
    setDiaSemana(novoDia);
    setDataAtendimento(proximaDataParaDiaSemana(novoDia, hojeIso()));
  }

  async function handleSubmitAgendamentoRecepcao(event) {
    event.preventDefault();
    setError("");

    if (!profissionalId || !profissionalAtual) {
      setError("Selecione o médico/profissional para o agendamento.");
      return;
    }

    if (!pacienteId) {
      setError(
        "Selecione o paciente que será atendido (ou cadastre um novo em Pacientes)."
      );
      return;
    }

    if (!dataAtendimento) {
      setError("Selecione a data do atendimento.");
      return;
    }

    const itensEscolhidos = catalogoSlotsComerciais.filter((s) =>
      slotsSelecionados.includes(s.key)
    );

    if (itensEscolhidos.length === 0) {
      setError(
        "Selecione pelo menos um horário comercial de 15 ou 20 minutos (entre 08:00 e 17:00)."
      );
      return;
    }

    const diaFinal = diaSemanaDeData(dataAtendimento);
    const profUuid = profissionalAtual.uuid || PROFISSIONAL_UUID_PADRAO;

    setSubmitting(true);
    try {
      let agendados = 0;

      for (const slot of itensEscolhidos) {
        const dataHoraIso = new Date(
          `${dataAtendimento}T${slot.inicio}:00`
        ).toISOString();

        // 1. Cria a consulta real no agendamento-service (para aparecer imediatamente na Agenda do Médico!)
        const respAgendamento = await fetchComSessao(
          `${API_URL}/agendamentos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paciente_id: pacienteId,
              profissional_id: profUuid,
              data_hora: dataHoraIso,
              duracao_minutos: duracaoMinutos,
              modalidade,
            }),
          }
        );

        const dadosAgendamento = await respAgendamento.json().catch(() => ({}));
        if (!respAgendamento.ok) {
          const detalhe =
            typeof dadosAgendamento.detail === "string"
              ? dadosAgendamento.detail
              : Array.isArray(dadosAgendamento.detail)
                ? dadosAgendamento.detail
                    .map((i) => i.msg)
                    .filter(Boolean)
                    .join(" ")
                : "Não foi possível registrar a consulta para o médico.";
          throw new Error(detalhe);
        }

        // 2. Registra também o horário no ms-profissionais (mantendo a tabela de disponibilidade sincronizada)
        try {
          await adicionarDisponibilidade(profissionalId, {
            dia_semana: diaFinal,
            data_atendimento: dataAtendimento,
            horario_inicio: slot.inicio,
            horario_fim: slot.fim,
          });
        } catch {
          /* se a faixa já existir no ms-profissionais, mantém o agendamento criado */
        }

        agendados += 1;
      }

      const nomePac = pacienteFormSelecionado?.label || "Paciente";
      showToast(
        agendados === 1
          ? `Consulta de ${nomePac} agendada para Dr(a). ${profissionalAtual.nome}!`
          : `${agendados} consultas de ${nomePac} agendadas para Dr(a). ${profissionalAtual.nome}!`
      );

      setSlotsSelecionados([]);
      await Promise.all([
        carregarAgenda(profissionalId),
        carregarAgendamentosClinica(),
        executarBusca(),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLiberarHorarioOcupado(infoOcupado) {
    try {
      if (infoOcupado?.consulta?.id) {
        await fetchComSessao(
          `${API_URL}/agendamentos/${infoOcupado.consulta.id}`,
          { method: "DELETE" }
        );
      }
      if (infoOcupado?.disponibilidade?.id) {
        await removerDisponibilidade(infoOcupado.disponibilidade.id);
      }
      showToast("Horário liberado com sucesso.");
      await Promise.all([
        carregarAgenda(profissionalId),
        carregarAgendamentosClinica(),
        executarBusca(),
      ]);
    } catch (err) {
      showToast(err.message || "Erro ao liberar horário.");
    }
  }

  const temFiltroBusca = Boolean(
    buscaEspecialidadeId || buscaProfissionalId || buscaDia || buscaData
  );

  function limparFiltrosBusca() {
    setBuscaEspecialidadeId("");
    setBuscaProfissionalId("");
    setBuscaDia("");
    setBuscaData("");
  }

  return (
    <div className="page-stack schedule-page">
      <section className="schedule-panel">
        <header className="schedule-panel-header">
          <div className="schedule-panel-header-main">
            <span
              className="schedule-panel-icon schedule-panel-icon-blue"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15.5 14" />
              </svg>
            </span>
            <div>
              <h2 className="card-title">
                Agendar consulta para o médico (Recepção / Admin)
              </h2>
              <p className="card-description">
                Selecione o médico, o paciente, a data e o horário comercial (15
                ou 20 min, das 08:00 às 17:00). O agendamento aparece direto na
                agenda do médico.
              </p>
            </div>
          </div>

          <div className="schedule-panel-header-actions">
            {profissionalAtual && (
              <span className="schedule-header-badge schedule-badge-active">
                {agendamentosDoMedico.length} consulta(s) na agenda de{" "}
                {profissionalAtual.nome}
              </span>
            )}

            <Btn
              variant="primary"
              size="sm"
              onClick={() =>
                navigate(
                  `/admin/agenda/calendario${
                    profissionalId ? `?profissional=${profissionalId}` : ""
                  }`
                )
              }
            >
              📅 Abrir Calendário Mensal
            </Btn>
          </div>
        </header>

        <div className="schedule-panel-body">
          <form
            className="admin-form"
            onSubmit={handleSubmitAgendamentoRecepcao}
          >
            {/* LINHA SUPERIOR: 1. MÉDICO | 2. PACIENTE | 3. DATA E MODALIDADE */}
            <div className="schedule-top-setup-3cols">
              <div className="schedule-field-group">
                <div className="schedule-field-head">
                  <span className="schedule-step-num">1</span>
                  <span className="form-label">Profissional (Médico)</span>
                </div>

                <SearchableCombobox
                  id="agenda-profissional"
                  placeholder="Pesquisar médico por nome, CRM ou especialidade..."
                  value={profissionalId}
                  options={opcoesProfissionaisForm}
                  selectedOption={profissionalFormSelecionado}
                  searching={buscandoProfFormServer}
                  hintText="Nome, registro ou especialidade"
                  emptyMessage="Nenhum profissional encontrado."
                  onSearchChange={setTermoBuscaProfForm}
                  onSelect={(novoId) => selecionarProfissional(novoId)}
                />
              </div>

              <div className="schedule-field-group">
                <div className="schedule-field-head schedule-field-head-between">
                  <div className="schedule-field-head-left">
                    <span className="schedule-step-num">2</span>
                    <span className="form-label">Paciente</span>
                  </div>

                  <button
                    type="button"
                    className="commercial-quick-link"
                    onClick={() => navigate("/admin/pacientes")}
                  >
                    + Cadastrar paciente
                  </button>
                </div>

                <SearchableCombobox
                  id="agenda-paciente-recepcao"
                  placeholder="Pesquisar paciente por nome ou CPF..."
                  value={pacienteId}
                  options={opcoesPacientesForm}
                  selectedOption={pacienteFormSelecionado}
                  searching={buscandoPacienteServer}
                  hintText="Busque por nome ou CPF"
                  emptyMessage="Nenhum paciente encontrado. Cadastre em Pacientes."
                  onSearchChange={setTermoBuscaPacienteForm}
                  onSelect={(novoPacId) => {
                    setPacienteId(novoPacId);
                    setError("");
                  }}
                />
              </div>

              <div className="schedule-field-group">
                <div className="schedule-field-head schedule-field-head-between">
                  <div className="schedule-field-head-left">
                    <span className="schedule-step-num">3</span>
                    <label
                      className="form-label"
                      htmlFor="agenda-data-atendimento"
                    >
                      Data e modalidade
                    </label>
                  </div>

                  <div
                    className="schedule-date-shortcuts"
                    role="group"
                    aria-label="Atalhos de data"
                  >
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        dataAtendimento === hojeIso()
                          ? "date-shortcut-chip-active"
                          : ""
                      }`}
                      onClick={() => handleChangeDataAtendimento(hojeIso())}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        dataAtendimento === somarDiasIso(hojeIso(), 1)
                          ? "date-shortcut-chip-active"
                          : ""
                      }`}
                      onClick={() =>
                        handleChangeDataAtendimento(somarDiasIso(hojeIso(), 1))
                      }
                    >
                      Amanhã
                    </button>
                    <button
                      type="button"
                      className={`date-shortcut-chip ${
                        dataAtendimento === somarDiasIso(hojeIso(), 7)
                          ? "date-shortcut-chip-active"
                          : ""
                      }`}
                      onClick={() =>
                        handleChangeDataAtendimento(somarDiasIso(hojeIso(), 7))
                      }
                    >
                      +7 dias
                    </button>
                  </div>
                </div>

                <div className="schedule-date-inline-row">
                  <input
                    id="agenda-data-atendimento"
                    type="date"
                    className="form-input schedule-date-input-compact"
                    value={dataAtendimento}
                    onChange={(e) =>
                      handleChangeDataAtendimento(e.target.value)
                    }
                    required
                  />

                  <select
                    aria-label="Modalidade do atendimento"
                    className="form-input"
                    style={{ flex: "1 1 135px" }}
                    value={modalidade}
                    onChange={(e) => setModalidade(e.target.value)}
                  >
                    <option value="presencial">Presencial</option>
                    <option value="teleconsulta">Teleconsulta</option>
                  </select>
                </div>
              </div>
            </div>

            {/* PASSO 4: GRADE COMPLETA DE HORÁRIOS EM LARGURA TOTAL SEM SCROLL */}
            <div className="schedule-field-group schedule-step3-full">
              <div className="schedule-step3-topbar">
                <div className="schedule-field-head-left">
                  <span className="schedule-step-num">4</span>
                  <div>
                    <span className="form-label">
                      Selecione o horário da consulta (08:00 às 17:00)
                    </span>
                    <small className="schedule-step3-subtitle">
                      {dataAtendimento
                        ? `Atendimento em ${formatDataExtenso(dataAtendimento)}`
                        : `Expediente toda ${LABEL_POR_DIA[diaSemana]}`}
                      {pacienteFormSelecionado
                        ? ` · Paciente: ${pacienteFormSelecionado.label}`
                        : " · Selecione um paciente no passo 2 acima"}
                    </small>
                  </div>
                </div>

                <div className="schedule-step3-controls">
                  <div
                    className="schedule-duration-box"
                    role="group"
                    aria-label="Tempo fixo de cada consulta"
                  >
                    <span className="schedule-duration-label">
                      Tempo por consulta:
                    </span>
                    {[15, 20].map((min) => (
                      <button
                        key={min}
                        type="button"
                        className={`duration-choice-btn ${
                          duracaoMinutos === min
                            ? "duration-choice-btn-active"
                            : ""
                        }`}
                        onClick={() => handleTrocarDuracao(min)}
                      >
                        {min} minutos
                      </button>
                    ))}
                  </div>

                  {slotsSelecionados.length > 0 && (
                    <button
                      type="button"
                      className="commercial-quick-link commercial-quick-clear"
                      onClick={() => setSlotsSelecionados([])}
                    >
                      Limpar seleção ({slotsSelecionados.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="commercial-legend-bar">
                <span className="commercial-legend-item">
                  <span className="commercial-legend-dot commercial-legend-dot-free" />
                  Disponível para agendar
                </span>
                <span className="commercial-legend-item">
                  <span className="commercial-legend-dot commercial-legend-dot-selected" />
                  Selecionado ({slotsSelecionados.length})
                </span>
                <span className="commercial-legend-item">
                  <span className="commercial-legend-dot commercial-legend-dot-occupied" />
                  Já ocupado nesta data ({mapaSlotsOcupadosNoDia.size}) — clique
                  no × para cancelar/liberar
                </span>
              </div>

              <div className="commercial-shifts-columns">
                {/* BLOCO MANHÃ: 08:00 às 12:00 */}
                <div className="commercial-shift-block">
                  <div className="commercial-shift-block-header">
                    <div>
                      <strong>☀ Turno da Manhã</strong>
                      <span>08:00 às 12:00 ({slotsManha.length} horários)</span>
                    </div>
                    <button
                      type="button"
                      className="commercial-shift-select-btn"
                      onClick={() => selecionarTurnoLivre("MANHA")}
                    >
                      Selecionar manhã
                    </button>
                  </div>

                  <div className="commercial-slots-grid-noscroll">
                    {slotsManha.map((slot) => {
                      const infoOcupado = mapaSlotsOcupadosNoDia.get(slot.key);
                      const ocupado = Boolean(infoOcupado);
                      const selecionado = slotsSelecionados.includes(slot.key);

                      if (ocupado) {
                        return (
                          <div
                            key={slot.key}
                            className="commercial-slot-chip commercial-slot-chip-occupied"
                            title={
                              infoOcupado.pacienteNome
                                ? `${slot.label} — Agendado para ${infoOcupado.pacienteNome}`
                                : `Horário ${slot.label} já ocupado nesta data`
                            }
                          >
                            <div className="commercial-slot-occupied-row">
                              <strong>
                                {slot.inicio} – {slot.fim}
                              </strong>
                              <button
                                type="button"
                                className="commercial-slot-remove-inline"
                                title="Cancelar/liberar este horário"
                                onClick={() =>
                                  handleLiberarHorarioOcupado(infoOcupado)
                                }
                              >
                                ×
                              </button>
                            </div>
                            <small
                              style={{
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {infoOcupado.pacienteNome || "Já agendado"}
                            </small>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => toggleSlotComercial(slot.key)}
                          className={`commercial-slot-chip ${
                            selecionado ? "commercial-slot-chip-selected" : ""
                          }`}
                        >
                          <strong>
                            {slot.inicio} – {slot.fim}
                          </strong>
                          <small>
                            {selecionado
                              ? "✓ Selecionado"
                              : `${duracaoMinutos} min`}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* BLOCO TARDE: 12:00 às 17:00 */}
                <div className="commercial-shift-block">
                  <div className="commercial-shift-block-header">
                    <div>
                      <strong>🌤 Turno da Tarde</strong>
                      <span>12:00 às 17:00 ({slotsTarde.length} horários)</span>
                    </div>
                    <button
                      type="button"
                      className="commercial-shift-select-btn"
                      onClick={() => selecionarTurnoLivre("TARDE")}
                    >
                      Selecionar tarde
                    </button>
                  </div>

                  <div className="commercial-slots-grid-noscroll">
                    {slotsTarde.map((slot) => {
                      const infoOcupado = mapaSlotsOcupadosNoDia.get(slot.key);
                      const ocupado = Boolean(infoOcupado);
                      const selecionado = slotsSelecionados.includes(slot.key);

                      if (ocupado) {
                        return (
                          <div
                            key={slot.key}
                            className="commercial-slot-chip commercial-slot-chip-occupied"
                            title={
                              infoOcupado.pacienteNome
                                ? `${slot.label} — Agendado para ${infoOcupado.pacienteNome}`
                                : `Horário ${slot.label} já ocupado nesta data`
                            }
                          >
                            <div className="commercial-slot-occupied-row">
                              <strong>
                                {slot.inicio} – {slot.fim}
                              </strong>
                              <button
                                type="button"
                                className="commercial-slot-remove-inline"
                                title="Cancelar/liberar este horário"
                                onClick={() =>
                                  handleLiberarHorarioOcupado(infoOcupado)
                                }
                              >
                                ×
                              </button>
                            </div>
                            <small
                              style={{
                                maxWidth: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {infoOcupado.pacienteNome || "Já agendado"}
                            </small>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot.key}
                          type="button"
                          onClick={() => toggleSlotComercial(slot.key)}
                          className={`commercial-slot-chip ${
                            selecionado ? "commercial-slot-chip-selected" : ""
                          }`}
                        >
                          <strong>
                            {slot.inicio} – {slot.fim}
                          </strong>
                          <small>
                            {selecionado
                              ? "✓ Selecionado"
                              : `${duracaoMinutos} min`}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="schedule-submit-footer">
              <div className="schedule-submit-summary">
                <strong>
                  {slotsSelecionados.length > 0
                    ? `${slotsSelecionados.length} horário(s) de ${duracaoMinutos} minutos selecionado(s)`
                    : "Clique nos horários desejados acima para selecionar"}
                </strong>
                <span>
                  {pacienteFormSelecionado
                    ? `Paciente: ${pacienteFormSelecionado.label} · `
                    : "Selecione o paciente no passo 2 · "}
                  Data: {formatDataBR(dataAtendimento)} (
                  {LABEL_POR_DIA[diaSemana]}) ·{" "}
                  {modalidade === "teleconsulta"
                    ? "Teleconsulta"
                    : "Presencial"}
                </span>
              </div>

              <div className="schedule-submit-buttons">
                <Btn
                  type="submit"
                  disabled={
                    submitting ||
                    !profissionalId ||
                    !pacienteId ||
                    slotsSelecionados.length === 0
                  }
                >
                  {submitting
                    ? "Agendando..."
                    : slotsSelecionados.length > 1
                      ? `+ Agendar ${slotsSelecionados.length} consultas para o médico`
                      : "+ Agendar consulta para o médico"}
                </Btn>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="schedule-panel">
        <header className="schedule-panel-header">
          <div className="schedule-panel-header-main">
            <span
              className="schedule-panel-icon schedule-panel-icon-teal"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <div>
              <h2 className="card-title">Consulta de horários configurados</h2>
              <p className="card-description">
                Pesquisa os horários de atendimento dos profissionais ativos
                filtrando por data, profissional, especialidade ou dia da
                semana.
              </p>
            </div>
          </div>

          <span
            className={`schedule-header-badge ${
              resultadosBusca.length > 0
                ? "schedule-badge-active"
                : "schedule-badge-neutral"
            }`}
          >
            {resultadosBusca.length} horário(s) encontrado(s)
          </span>
        </header>

        <div className="schedule-panel-body">
          <div className="schedule-filter-box">
            <div className="schedule-filter-box-head">
              <div className="schedule-filter-box-title">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>Filtros de pesquisa</span>
                {temFiltroBusca && (
                  <span className="schedule-filter-active-pill">
                    {[
                      buscaEspecialidadeId,
                      buscaProfissionalId,
                      buscaData,
                      buscaDia,
                    ].filter(Boolean).length}{" "}
                    ativo(s)
                  </span>
                )}
              </div>

              <div className="schedule-filter-quick-actions">
                <button
                  type="button"
                  className={`date-shortcut-chip ${
                    buscaData === hojeIso() ? "date-shortcut-chip-active" : ""
                  }`}
                  onClick={() =>
                    setBuscaData(buscaData === hojeIso() ? "" : hojeIso())
                  }
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`date-shortcut-chip ${
                    buscaData === somarDiasIso(hojeIso(), 1)
                      ? "date-shortcut-chip-active"
                      : ""
                  }`}
                  onClick={() => {
                    const amanha = somarDiasIso(hojeIso(), 1);
                    setBuscaData(buscaData === amanha ? "" : amanha);
                  }}
                >
                  Amanhã
                </button>
                {temFiltroBusca && (
                  <button
                    type="button"
                    className="schedule-filter-clear-btn"
                    onClick={limparFiltrosBusca}
                  >
                    ✕ Limpar filtros
                  </button>
                )}
              </div>
            </div>

            <div className="schedule-filter-bar schedule-filter-bar-4cols">
              <div className="schedule-filter-field">
                <label
                  className="schedule-filter-label"
                  htmlFor="filtro-especialidade-uc08"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                  Especialidade
                </label>
                <select
                  id="filtro-especialidade-uc08"
                  className={`form-input schedule-filter-control ${
                    buscaEspecialidadeId ? "schedule-filter-control-active" : ""
                  }`}
                  aria-label="Filtrar busca por especialidade"
                  value={buscaEspecialidadeId}
                  onChange={(e) => setBuscaEspecialidadeId(e.target.value)}
                >
                  <option value="">Todas as especialidades</option>
                  {especialidades.map((esp) => (
                    <option key={esp.id} value={esp.id}>
                      {esp.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="schedule-filter-field">
                <span className="schedule-filter-label">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profissional ativo
                </span>
                <SearchableCombobox
                  id="filtro-profissional-uc08"
                  placeholder="Todos os profissionais ativos..."
                  value={buscaProfissionalId}
                  options={opcoesProfissionaisFiltro}
                  selectedOption={profissionalFiltroSelecionado}
                  searching={buscandoProfFiltroServer}
                  hintText="Digite nome ou registro"
                  emptyMessage="Nenhum profissional ativo encontrado."
                  onSearchChange={setTermoBuscaProfFiltro}
                  onSelect={(val) => setBuscaProfissionalId(val)}
                />
              </div>

              <div className="schedule-filter-field">
                <label
                  className="schedule-filter-label"
                  htmlFor="filtro-data-uc08"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Data do atendimento
                </label>
                <input
                  id="filtro-data-uc08"
                  type="date"
                  className={`form-input schedule-filter-control ${
                    buscaData ? "schedule-filter-control-active" : ""
                  }`}
                  aria-label="Filtrar busca por data do atendimento"
                  value={buscaData}
                  onChange={(e) => setBuscaData(e.target.value)}
                />
              </div>

              <div className="schedule-filter-field">
                <label
                  className="schedule-filter-label"
                  htmlFor="filtro-dia-uc08"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Dia da semana
                </label>
                <select
                  id="filtro-dia-uc08"
                  className={`form-input schedule-filter-control ${
                    buscaDia ? "schedule-filter-control-active" : ""
                  }`}
                  aria-label="Filtrar busca por dia da semana"
                  value={buscaDia}
                  onChange={(e) => setBuscaDia(e.target.value)}
                >
                  <option value="">Todos os dias da semana</option>
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loadingBusca ? (
            <div className="schedule-empty-box schedule-empty-box-compact">
              <strong>Consultando horários...</strong>
            </div>
          ) : resultadosBusca.length === 0 ? (
            <div className="schedule-empty-box schedule-empty-box-compact">
              <span className="schedule-empty-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <strong>Nenhum horário disponível para esses filtros</strong>
              <p>
                Apenas profissionais ativos e com horários configurados aparecem
                nesta consulta.
              </p>
            </div>
          ) : (
            <div className="availability-results-grid">
              {resultadosBusca.map((item) => (
                <article
                  className="availability-result-card"
                  key={item.disponibilidade_id}
                >
                  <div
                    className="patient-avatar avatar-blue"
                    aria-hidden="true"
                  >
                    {
                      DIAS_SEMANA.find((d) => d.value === item.dia_semana)
                        ?.short
                    }
                  </div>

                  <div className="record-list-patient">
                    <div className="availability-card-top">
                      <strong>{item.profissional_nome}</strong>
                      <span className="availability-time-pill">
                        {formatHora(item.horario_inicio)} às{" "}
                        {formatHora(item.horario_fim)}
                      </span>
                    </div>
                    <div className="availability-meta-line">
                      <span>{LABEL_POR_DIA[item.dia_semana]}</span>
                      <span
                        className={`slot-date-chip ${
                          item.data_atendimento
                            ? "slot-date-chip-specific"
                            : "slot-date-chip-recurring"
                        }`}
                      >
                        {item.data_atendimento
                          ? `📅 ${formatDataBR(item.data_atendimento)}`
                          : "↻ Semanal"}
                      </span>
                    </div>
                    {item.especialidades.length > 0 && (
                      <div className="tag-list">
                        {item.especialidades.map((esp) => (
                          <span key={esp.id} className="specialty-tag">
                            {esp.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
