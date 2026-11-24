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
  adicionarDisponibilidade,
  diaSemanaDeData,
  formatDataBR,
  formatDataExtenso,
  formatHora,
  hojeIso,
  listarDisponibilidades,
  listarProfissionais,
  removerDisponibilidade,
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

const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const CABECALHO_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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

function construirGradeMes(ano, mesZeroBased) {
  const primeiroDia = new Date(ano, mesZeroBased, 1);
  const ultimoDia = new Date(ano, mesZeroBased + 1, 0);
  const totalDias = ultimoDia.getDate();

  const offsetInicio = (primeiroDia.getDay() + 6) % 7;
  const celulas = [];

  for (let i = 0; i < offsetInicio; i += 1) {
    celulas.push(null);
  }

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const mStr = String(mesZeroBased + 1).padStart(2, "0");
    const dStr = String(dia).padStart(2, "0");
    const dataIso = `${ano}-${mStr}-${dStr}`;
    celulas.push({
      dia,
      dataIso,
      diaSemana: diaSemanaDeData(dataIso),
    });
  }

  return celulas;
}

export default function AgendaCalendarioAdmin() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const hoje = useMemo(() => hojeIso(), []);
  const [anoMes, setAnoMes] = useState(() => {
    const d = new Date(`${hoje}T12:00:00`);
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  const [profissionais, setProfissionais] = useState([]);
  const [profissionalId, setProfissionalId] = useState(
    searchParams.get("profissional") || ""
  );
  const [termoBuscaProf, setTermoBuscaProf] = useState("");
  const [buscandoProfServer, setBuscandoProfServer] = useState(false);

  const [pacientesLista, setPacientesLista] = useState([]);
  const [pacientesMap, setPacientesMap] = useState({});
  const [pacienteId, setPacienteId] = useState("");
  const [termoBuscaPac, setTermoBuscaPac] = useState("");
  const [buscandoPacServer, setBuscandoPacServer] = useState(false);
  const [modalidade, setModalidade] = useState("presencial");

  const [disponibilidades, setDisponibilidades] = useState([]);
  const [agendamentosClinica, setAgendamentosClinica] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [duracaoMinutos, setDuracaoMinutos] = useState(15);
  const [slotsParaAdicionar, setSlotsParaAdicionar] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const carregarDadosClinica = useCallback(async () => {
    try {
      const [respPac, respAg] = await Promise.all([
        fetchComSessao(`${API_URL}/api/v1/pacientes?ativo=true&limit=100`),
        fetchComSessao(`${API_URL}/agendamentos`),
      ]);

      if (respPac.ok) {
        const dadosPac = await respPac.json();
        const lista = Array.isArray(dadosPac)
          ? dadosPac
          : Array.isArray(dadosPac?.items)
            ? dadosPac.items
            : [];
        setPacientesLista(lista.filter((p) => p?.ativo !== false));
        const mapa = {};
        for (const p of lista) {
          if (p?.id) mapa[String(p.id).toLowerCase()] = p;
          if (p?.user_account_id)
            mapa[String(p.user_account_id).toLowerCase()] = p;
        }
        setPacientesMap((prev) => ({ ...prev, ...mapa }));
      }

      if (respAg.ok) {
        const dadosAg = await respAg.json();
        if (Array.isArray(dadosAg)) setAgendamentosClinica(dadosAg);
      }
    } catch {
      /* ignora falha */
    }
  }, []);

  useEffect(() => {
    Promise.all([listarProfissionais(), carregarDadosClinica()])
      .then(([profs]) => {
        const lista = (Array.isArray(profs) ? profs : []).map((p, idx) => ({
          ...p,
          uuid: resolverUuidProfissional(p, idx),
        }));
        setProfissionais(lista);
        if (!profissionalId && lista.length > 0) {
          setProfissionalId(String(lista[0].id));
        }
      })
      .catch((err) => showToast(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const termo = termoBuscaProf.trim();
    if (!termo) return;
    const timer = setTimeout(async () => {
      setBuscandoProfServer(true);
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
        /* mantém lista atual */
      } finally {
        setBuscandoProfServer(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [termoBuscaProf]);

  useEffect(() => {
    const termo = termoBuscaPac.trim();
    if (!termo) return;
    const timer = setTimeout(async () => {
      setBuscandoPacServer(true);
      try {
        const params = new URLSearchParams({
          ativo: "true",
          limit: "25",
          busca: termo,
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
          setPacientesLista((prev) => {
            const porId = new Map();
            for (const item of [...lista, ...prev]) {
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
          setPacientesMap((prev) => ({ ...prev, ...novoMapa }));
        }
      } catch {
        /* mantém cache */
      } finally {
        setBuscandoPacServer(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [termoBuscaPac]);

  const carregarAgenda = useCallback(
    async (id) => {
      if (!id) {
        setDisponibilidades([]);
        return;
      }
      setLoading(true);
      try {
        const lista = await listarDisponibilidades(id);
        setDisponibilidades(Array.isArray(lista) ? lista : []);
      } catch (err) {
        showToast(err.message);
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    carregarAgenda(profissionalId);
  }, [profissionalId, carregarAgenda]);

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

  const opcoesProfissionais = useMemo(() => {
    const termo = normalizarTextoBusca(termoBuscaProf);
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
      .map((prof) => ({
        value: String(prof.id),
        label: prof.nome,
        initials: iniciaisDeNome(prof.nome),
        badge: prof.documento_registro,
        subtitle: [
          prof.especialidades?.[0]?.nome,
          `Reg.: ${prof.documento_registro}`,
        ]
          .filter(Boolean)
          .join(" · "),
      }));
  }, [profissionais, termoBuscaProf]);

  const profSelecionadoOption = useMemo(() => {
    if (!profissionalId) return null;
    return (
      opcoesProfissionais.find(
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
  }, [profissionalId, opcoesProfissionais, profissionalAtual]);

  const opcoesPacientes = useMemo(() => {
    const termo = normalizarTextoBusca(termoBuscaPac);
    const digitos = termoBuscaPac.replace(/\D/g, "");
    return pacientesLista
      .filter((pac) => {
        if (!termo && !digitos) return true;
        const nome = normalizarTextoBusca(obterNomePaciente(pac));
        const cpf = String(pac?.cpf || "").replace(/\D/g, "");
        return (
          (termo && nome.includes(termo)) || (digitos && cpf.includes(digitos))
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
  }, [pacientesLista, termoBuscaPac]);

  const pacienteSelecionadoOption = useMemo(() => {
    if (!pacienteId) return null;
    return (
      opcoesPacientes.find((o) => String(o.value) === String(pacienteId)) ||
      null
    );
  }, [pacienteId, opcoesPacientes]);

  const agendamentosDoMedico = useMemo(() => {
    if (!profissionalAtual?.uuid) return [];
    const uuidAlvo = String(profissionalAtual.uuid).toLowerCase();
    return agendamentosClinica
      .filter(
        (apt) => String(apt.profissional_id || "").toLowerCase() === uuidAlvo
      )
      .map((apt) => {
        const dataApt = extrairDataLocalIso(apt.data_hora);
        const vencido =
          dataApt &&
          dataApt < hoje &&
          (apt.status === "agendado" || apt.status === "aguardando");
        return vencido
          ? { ...apt, status: "cancelado", canceladoAutomatico: true }
          : apt;
      });
  }, [agendamentosClinica, profissionalAtual, hoje]);

  const celulasMes = useMemo(
    () => construirGradeMes(anoMes.ano, anoMes.mes),
    [anoMes]
  );

  // Agrupa todas as consultas (realizadas, canceladas, faltas e agendadas) e disponibilidades por data ISO
  const itensPorDataIso = useMemo(() => {
    const mapa = {};
    for (const celula of celulasMes) {
      if (!celula) continue;
      const ehPassado = celula.dataIso < hoje;

      const consultasData = agendamentosDoMedico
        .filter((apt) => extrairDataLocalIso(apt.data_hora) === celula.dataIso)
        .map((apt) => {
          const ini = extrairHoraLocal(apt.data_hora);
          const minFim =
            horarioParaMinutos(ini) + (Number(apt.duracao_minutos) || 15);
          const fim = `${String(Math.floor(minFim / 60)).padStart(
            2,
            "0"
          )}:${String(minFim % 60).padStart(2, "0")}`;
          const pac =
            pacientesMap[String(apt.paciente_id || "").toLowerCase()];
          const status = String(apt.status || "agendado").toLowerCase();
          const statusLabel =
            status === "concluido" || status === "concluída"
              ? "Realizada"
              : status === "nao_compareceu"
                ? "Não compareceu"
                : status === "cancelado"
                  ? apt.canceladoAutomatico
                    ? "Cancelada (não iniciada no dia)"
                    : "Cancelada"
                  : "Programada";
          const statusKey =
            status === "concluido" || status === "concluída"
              ? "completed"
              : status === "nao_compareceu"
                ? "noshow"
                : status === "cancelado"
                  ? "cancelled"
                  : "confirmed";

          return {
            key: `apt-${apt.id}`,
            tipo: "CONSULTA",
            id: apt.id,
            inicio: ini,
            fim,
            pacienteNome: obterNomePaciente(pac) || "Paciente agendado",
            modalidade:
              apt.modalidade === "teleconsulta" ? "Teleconsulta" : "Presencial",
            status,
            statusLabel,
            statusKey,
          };
        });

      // Em datas passadas, exibe apenas o histórico real de consultas (sem faixas vazias recorrentes)
      const dispData = ehPassado
        ? []
        : disponibilidades
            .filter((slot) => {
              if (slot.data_atendimento) {
                return slot.data_atendimento === celula.dataIso;
              }
              return slot.dia_semana === celula.diaSemana;
            })
            .filter((slot) => {
              const ini = formatHora(slot.horario_inicio);
              return !consultasData.some((c) => c.inicio === ini);
            })
            .map((slot) => ({
              key: `disp-${slot.id}`,
              tipo: "DISPONIBILIDADE",
              id: slot.id,
              inicio: formatHora(slot.horario_inicio),
              fim: formatHora(slot.horario_fim),
              pacienteNome: null,
              status: "disponivel",
              statusLabel: "Horário livre",
              statusKey: "confirmed",
              recorrente: !slot.data_atendimento,
            }));

      mapa[celula.dataIso] = [...consultasData, ...dispData].sort((a, b) =>
        a.inicio.localeCompare(b.inicio)
      );
    }
    return mapa;
  }, [celulasMes, agendamentosDoMedico, disponibilidades, pacientesMap, hoje]);

  const ehDataSelecionadaPassada = useMemo(
    () => Boolean(dataSelecionada && dataSelecionada < hoje),
    [dataSelecionada, hoje]
  );

  const itensDoDiaSelecionado = useMemo(() => {
    if (!dataSelecionada) return [];
    return itensPorDataIso[dataSelecionada] || [];
  }, [dataSelecionada, itensPorDataIso]);

  const resumoDiaSelecionado = useMemo(() => {
    let realizadas = 0;
    let canceladas = 0;
    let faltas = 0;
    let programadas = 0;
    for (const item of itensDoDiaSelecionado) {
      if (item.statusKey === "completed") realizadas += 1;
      else if (item.statusKey === "cancelled") canceladas += 1;
      else if (item.statusKey === "noshow") faltas += 1;
      else programadas += 1;
    }
    return { realizadas, canceladas, faltas, programadas };
  }, [itensDoDiaSelecionado]);

  const catalogoComercial = useMemo(
    () => gerarSlotsComerciais(duracaoMinutos),
    [duracaoMinutos]
  );

  const slotsOcupadosNoDiaSelecionado = useMemo(() => {
    const ocupados = new Set();
    const ativosDoDia = itensDoDiaSelecionado.filter(
      (s) => s.statusKey !== "cancelled" && s.statusKey !== "noshow"
    );
    for (const item of catalogoComercial) {
      const iniNovo = horarioParaMinutos(item.inicio);
      const fimNovo = horarioParaMinutos(item.fim);
      const conflita = ativosDoDia.some((s) => {
        const iniExist = horarioParaMinutos(s.inicio);
        const fimExist = horarioParaMinutos(s.fim);
        return iniNovo < fimExist && fimNovo > iniExist;
      });
      if (conflita) ocupados.add(item.key);
    }
    return ocupados;
  }, [catalogoComercial, itensDoDiaSelecionado]);

  function mudarMes(delta) {
    setAnoMes((atual) => {
      const novaData = new Date(atual.ano, atual.mes + delta, 1);
      return { ano: novaData.getFullYear(), mes: novaData.getMonth() };
    });
  }

  function irParaHoje() {
    const d = new Date(`${hoje}T12:00:00`);
    setAnoMes({ ano: d.getFullYear(), mes: d.getMonth() });
    setDataSelecionada(hoje);
  }

  function toggleSlotNovo(key) {
    if (slotsOcupadosNoDiaSelecionado.has(key)) return;
    setSlotsParaAdicionar((atuais) =>
      atuais.includes(key)
        ? atuais.filter((k) => k !== key)
        : [...atuais, key]
    );
  }

  async function handleAdicionarNoDia() {
    if (!profissionalId || !profissionalAtual || !dataSelecionada) return;
    if (!pacienteId) {
      showToast("Selecione o paciente antes de confirmar o agendamento.");
      return;
    }

    const escolhidos = catalogoComercial.filter((s) =>
      slotsParaAdicionar.includes(s.key)
    );
    if (escolhidos.length === 0) return;

    const diaSem = diaSemanaDeData(dataSelecionada);
    const profUuid = profissionalAtual.uuid || PROFISSIONAL_UUID_PADRAO;

    setSalvando(true);
    try {
      for (const s of escolhidos) {
        const dataHoraIso = new Date(
          `${dataSelecionada}T${s.inicio}:00`
        ).toISOString();

        const resp = await fetchComSessao(`${API_URL}/agendamentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paciente_id: pacienteId,
            profissional_id: profUuid,
            data_hora: dataHoraIso,
            duracao_minutos: duracaoMinutos,
            modalidade,
          }),
        });

        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(
            typeof dados.detail === "string"
              ? dados.detail
              : "Não foi possível agendar a consulta."
          );
        }

        try {
          await adicionarDisponibilidade(profissionalId, {
            dia_semana: diaSem,
            data_atendimento: dataSelecionada,
            horario_inicio: s.inicio,
            horario_fim: s.fim,
          });
        } catch {
          /* ignora se faixa já existir */
        }
      }

      setSlotsParaAdicionar([]);
      showToast(
        `${escolhidos.length} consulta(s) agendada(s) em ${formatDataBR(
          dataSelecionada
        )}!`
      );
      await Promise.all([
        carregarAgenda(profissionalId),
        carregarDadosClinica(),
      ]);
    } catch (err) {
      showToast(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemoverItem(item) {
    try {
      if (item.tipo === "CONSULTA") {
        await fetchComSessao(`${API_URL}/agendamentos/${item.id}`, {
          method: "DELETE",
        });
      } else {
        await removerDisponibilidade(item.id);
      }
      showToast("Agendamento/horário removido.");
      await Promise.all([
        carregarAgenda(profissionalId),
        carregarDadosClinica(),
      ]);
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="page-stack schedule-page">
      <section className="schedule-panel">
        <header className="schedule-panel-header">
          <div className="schedule-panel-header-main">
            <Btn
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(
                  `/admin/agenda${
                    profissionalId ? `?profissional=${profissionalId}` : ""
                  }`
                )
              }
            >
              ← Voltar para Configurar Agenda
            </Btn>

            <div>
              <h2 className="card-title">
                Calendário Mensal da Agenda
                {profissionalAtual ? ` — ${profissionalAtual.nome}` : ""}
              </h2>
              <p className="card-description">
                Clique em qualquer dia do calendário para ver os pacientes
                agendados ou marcar novas consultas naquela data.
              </p>
            </div>
          </div>

          <div style={{ minWidth: "310px", maxWidth: "380px", width: "100%" }}>
            <SearchableCombobox
              id="calendario-select-profissional"
              placeholder="Pesquisar médico por nome ou CRM..."
              value={profissionalId}
              options={opcoesProfissionais}
              selectedOption={profSelecionadoOption}
              searching={buscandoProfServer}
              hintText="Nome, registro ou especialidade"
              onSearchChange={setTermoBuscaProf}
              onSelect={(novoId) => {
                setProfissionalId(novoId);
                setSearchParams(novoId ? { profissional: novoId } : {});
              }}
            />
          </div>
        </header>

        <div className="schedule-panel-body">
          <div className="calendar-full-workspace">
            {/* COLUNA ESQUERDA: GRADE MENSAL */}
            <div className="calendar-month-card">
              <div className="calendar-month-topbar">
                <div className="calendar-month-title">
                  <strong>
                    {NOMES_MESES[anoMes.mes]} de {anoMes.ano}
                  </strong>
                  <small>
                    {loading
                      ? "Atualizando..."
                      : `${agendamentosDoMedico.length} consulta(s) agendada(s) para o médico`}
                  </small>
                </div>

                <div className="schedule-week-Step-controls">
                  <button
                    type="button"
                    className="schedule-week-nav-btn"
                    onClick={() => mudarMes(-1)}
                  >
                    ◀ Mês anterior
                  </button>
                  <button
                    type="button"
                    className="schedule-week-nav-btn"
                    onClick={irParaHoje}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    className="schedule-week-nav-btn"
                    onClick={() => mudarMes(1)}
                  >
                    Próximo mês ▶
                  </button>
                </div>
              </div>

              <div className="calendar-month-weekdays">
                {CABECALHO_SEMANA.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="calendar-month-grid">
                {celulasMes.map((celula, idx) => {
                  if (!celula) {
                    return (
                      <div
                        key={`vazio-${idx}`}
                        className="calendar-day-cell calendar-day-cell-empty"
                      />
                    );
                  }
                  const itensDia = itensPorDataIso[celula.dataIso] || [];
                  const selecionado = celula.dataIso === dataSelecionada;
                  const ehHoje = celula.dataIso === hoje;

                  return (
                    <button
                      type="button"
                      key={celula.dataIso}
                      onClick={() => {
                        setDataSelecionada(celula.dataIso);
                        setSlotsParaAdicionar([]);
                      }}
                      className={`calendar-day-cell ${
                        selecionado ? "calendar-day-cell-selected" : ""
                      } ${ehHoje ? "calendar-day-cell-today" : ""} ${
                        itensDia.length > 0 ? "calendar-day-cell-has-slots" : ""
                      }`}
                    >
                      <div className="calendar-day-cell-top">
                        <span className="calendar-day-number">
                          {celula.dia}
                        </span>
                        {itensDia.length > 0 && (
                          <span className="calendar-day-count-badge">
                            {itensDia.length} ag.
                          </span>
                        )}
                      </div>

                      <div className="calendar-day-previews">
                        {itensDia.slice(0, 3).map((s) => (
                          <span
                            key={s.key}
                            className={`calendar-day-mini-pill calendar-day-mini-pill-${s.statusKey}`}
                          >
                            {s.inicio}
                            {s.pacienteNome
                              ? ` · ${s.pacienteNome.split(" ")[0]}`
                              : ""}
                          </span>
                        ))}
                        {itensDia.length > 3 && (
                          <span className="calendar-day-more-pill">
                            +{itensDia.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* COLUNA DIREITA: HISTÓRICO (SE DATA PASSADA) OU AGENDAMENTO (SE HOJE/FUTURO) */}
            <aside className="calendar-day-detail-card">
              <div className="calendar-day-detail-header">
                <span className="eyebrow">
                  {ehDataSelecionadaPassada
                    ? "HISTÓRICO DE CONSULTAS (DATA ENCERRADA)"
                    : "DATA SELECIONADA"}
                </span>
                <h3>{formatDataExtenso(dataSelecionada)}</h3>
                <p>
                  {itensDoDiaSelecionado.length === 0
                    ? ehDataSelecionadaPassada
                      ? "Nenhum registro de consulta nesta data."
                      : "Nenhuma consulta agendada para esta data."
                    : `${itensDoDiaSelecionado.length} registro(s) encontrado(s) em ${formatDataBR(
                        dataSelecionada
                      )}.`}
                </p>

                {itensDoDiaSelecionado.length > 0 && (
                  <div className="calendar-history-summary-pills">
                    {resumoDiaSelecionado.realizadas > 0 && (
                      <span className="calendar-summary-chip calendar-summary-chip-completed">
                        ✓ {resumoDiaSelecionado.realizadas} realizada(s)
                      </span>
                    )}
                    {resumoDiaSelecionado.canceladas > 0 && (
                      <span className="calendar-summary-chip calendar-summary-chip-cancelled">
                        ✕ {resumoDiaSelecionado.canceladas} cancelada(s)
                      </span>
                    )}
                    {resumoDiaSelecionado.faltas > 0 && (
                      <span className="calendar-summary-chip calendar-summary-chip-noshow">
                        ⊘ {resumoDiaSelecionado.faltas} não compareceu
                      </span>
                    )}
                    {resumoDiaSelecionado.programadas > 0 && (
                      <span className="calendar-summary-chip calendar-summary-chip-confirmed">
                        ◷ {resumoDiaSelecionado.programadas} programada(s)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="calendar-day-detail-section">
                <strong className="calendar-day-section-title">
                  {ehDataSelecionadaPassada
                    ? `Histórico do dia ${formatDataBR(dataSelecionada)}`
                    : `Consultas em ${formatDataBR(dataSelecionada)}`}
                </strong>

                {itensDoDiaSelecionado.length === 0 ? (
                  <div className="calendar-day-empty-notice">
                    {ehDataSelecionadaPassada
                      ? "Não houve consultas registradas nesta data."
                      : "Esta data está livre. Selecione o paciente e o horário abaixo para agendar."}
                  </div>
                ) : (
                  <div className="calendar-history-list">
                    {itensDoDiaSelecionado.map((item) => (
                      <article
                        key={item.key}
                        className={`calendar-history-item calendar-history-item-${item.statusKey}`}
                      >
                        <div className="calendar-history-item-main">
                          <div className="calendar-history-time-row">
                            <strong>
                              {item.inicio} – {item.fim}
                            </strong>
                            <span
                              className={`status-pill status-${item.statusKey}`}
                            >
                              {item.statusLabel}
                            </span>
                          </div>
                          {item.pacienteNome && (
                            <div className="calendar-history-patient-row">
                              <span className="calendar-history-patient-name">
                                {item.pacienteNome}
                              </span>
                              {item.modalidade && (
                                <small className="calendar-history-modality">
                                  · {item.modalidade}
                                </small>
                              )}
                            </div>
                          )}
                        </div>

                        {!ehDataSelecionadaPassada && (
                          <button
                            type="button"
                            className="slot-action-btn slot-action-remove"
                            title="Remover agendamento"
                            onClick={() => handleRemoverItem(item)}
                          >
                            ×
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {ehDataSelecionadaPassada ? (
                <div className="calendar-past-date-lock-notice">
                  <span>🔒</span>
                  <div>
                    <strong>Data anterior à atual</strong>
                    <p>
                      Datas passadas exibem apenas o histórico de consultas
                      (realizadas, canceladas e ausências) e não permitem novos
                      agendamentos.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="calendar-day-detail-section">
                  <strong className="calendar-day-section-title">
                    Novo agendamento em {formatDataBR(dataSelecionada)}
                  </strong>

                  <SearchableCombobox
                    id="calendario-select-paciente"
                    label="Paciente"
                    placeholder="Pesquisar paciente por nome ou CPF..."
                    value={pacienteId}
                    options={opcoesPacientes}
                    selectedOption={pacienteSelecionadoOption}
                    searching={buscandoPacServer}
                    hintText="Busque por nome ou CPF"
                    onSearchChange={setTermoBuscaPac}
                    onSelect={(val) => setPacienteId(val)}
                  />

                  <div
                    className="schedule-field-head schedule-field-head-between"
                    style={{ marginTop: "6px" }}
                  >
                    <select
                      aria-label="Modalidade"
                      className="form-input"
                      style={{ maxWidth: "150px", height: "36px" }}
                      value={modalidade}
                      onChange={(e) => setModalidade(e.target.value)}
                    >
                      <option value="presencial">Presencial</option>
                      <option value="teleconsulta">Teleconsulta</option>
                    </select>

                    <div className="schedule-duration-toggle">
                      {[15, 20].map((min) => (
                        <button
                          key={min}
                          type="button"
                          className={`date-shortcut-chip ${
                            duracaoMinutos === min
                              ? "date-shortcut-chip-active"
                              : ""
                          }`}
                          onClick={() => {
                            setDuracaoMinutos(min);
                            setSlotsParaAdicionar([]);
                          }}
                        >
                          ⏱ {min} min
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="commercial-slots-grid-noscroll">
                    {catalogoComercial.map((slot) => {
                      const ocupado = slotsOcupadosNoDiaSelecionado.has(
                        slot.key
                      );
                      const selecionado = slotsParaAdicionar.includes(slot.key);
                      return (
                        <button
                          key={slot.key}
                          type="button"
                          disabled={ocupado}
                          onClick={() => toggleSlotNovo(slot.key)}
                          className={`commercial-slot-chip ${
                            selecionado ? "commercial-slot-chip-selected" : ""
                          } ${ocupado ? "commercial-slot-chip-occupied" : ""}`}
                        >
                          <strong>
                            {slot.inicio} – {slot.fim}
                          </strong>
                          <small>
                            {ocupado
                              ? "Ocupado"
                              : selecionado
                                ? "✓ Selecionado"
                                : `${duracaoMinutos} min`}
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: "10px" }}>
                    <Btn
                      className="btn-block"
                      disabled={
                        salvando ||
                        !profissionalId ||
                        !pacienteId ||
                        slotsParaAdicionar.length === 0
                      }
                      onClick={handleAdicionarNoDia}
                    >
                      {salvando
                        ? "Agendando..."
                        : slotsParaAdicionar.length > 0
                          ? `+ Agendar ${slotsParaAdicionar.length} consulta(s) em ${formatDataBR(
                              dataSelecionada
                            )}`
                          : "Selecione o paciente e o horário acima"}
                    </Btn>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
