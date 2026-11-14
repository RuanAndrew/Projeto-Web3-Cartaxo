const API_URL =
  import.meta.env.VITE_PROFISSIONAIS_API_URL || "http://localhost:8006";

async function request(path, options = {}) {
  const { body, headers, ...rest } = options;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Não foi possível conectar ao ms-profissionais em ${API_URL}. Verifique se o container está rodando.`
    );
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    if (typeof detail === "string") {
      throw new Error(detail);
    }
    if (Array.isArray(detail) && detail.length > 0) {
      throw new Error(
        detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
      );
    }
    throw new Error(`Erro ${response.status} ao comunicar com o servidor.`);
  }

  return data;
}

export const DIAS_SEMANA = [
  { value: "SEGUNDA", label: "Segunda-feira", short: "Seg", jsDay: 1 },
  { value: "TERCA", label: "Terça-feira", short: "Ter", jsDay: 2 },
  { value: "QUARTA", label: "Quarta-feira", short: "Qua", jsDay: 3 },
  { value: "QUINTA", label: "Quinta-feira", short: "Qui", jsDay: 4 },
  { value: "SEXTA", label: "Sexta-feira", short: "Sex", jsDay: 5 },
  { value: "SABADO", label: "Sábado", short: "Sáb", jsDay: 6 },
  { value: "DOMINGO", label: "Domingo", short: "Dom", jsDay: 0 },
];

export function formatHora(valor = "") {
  return valor.slice(0, 5);
}

export function hojeIso() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function somarDiasIso(dataIso, dias) {
  const base = dataIso ? new Date(`${dataIso}T12:00:00`) : new Date();
  base.setDate(base.getDate() + dias);
  const ano = base.getFullYear();
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  const dia = String(base.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function diaSemanaDeData(dataIso = "") {
  if (!dataIso) return "SEGUNDA";
  const d = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "SEGUNDA";
  const jsDay = d.getDay();
  return (
    DIAS_SEMANA.find((item) => item.jsDay === jsDay)?.value || "SEGUNDA"
  );
}

export function proximaDataParaDiaSemana(diaValor, referenciaIso = "") {
  const base = referenciaIso
    ? new Date(`${referenciaIso}T12:00:00`)
    : new Date();
  const alvo = DIAS_SEMANA.find((d) => d.value === diaValor);
  if (!alvo || Number.isNaN(base.getTime())) return hojeIso();
  const diff = (alvo.jsDay - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + diff);
  const ano = base.getFullYear();
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  const dia = String(base.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function formatDataBR(dataIso = "") {
  if (!dataIso) return "";
  const partes = String(dataIso).slice(0, 10).split("-");
  if (partes.length !== 3) return dataIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function formatDataExtenso(dataIso = "") {
  if (!dataIso) return "";
  const d = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dataIso;
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Especialidades (UC06)
export const listarEspecialidades = () => request("/especialidades");
export const criarEspecialidade = (nome) =>
  request("/especialidades", { method: "POST", body: { nome } });
export const atualizarEspecialidade = (id, nome) =>
  request(`/especialidades/${id}`, { method: "PUT", body: { nome } });
export const removerEspecialidade = (id) =>
  request(`/especialidades/${id}`, { method: "DELETE" });

// Profissionais (UC05) e vínculo N:N com especialidades
export const listarProfissionais = (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      params.set(k, String(v));
    }
  });
  const qs = params.toString();
  return request(`/profissionais${qs ? `?${qs}` : ""}`);
};
export const criarProfissional = (dados) =>
  request("/profissionais", { method: "POST", body: dados });
export const atualizarProfissional = (id, dados) =>
  request(`/profissionais/${id}`, { method: "PUT", body: dados });
export const alterarStatusProfissional = (id, ativo) =>
  request(`/profissionais/${id}`, { method: "PATCH", body: { ativo } });
export const removerProfissional = (id) =>
  request(`/profissionais/${id}`, { method: "DELETE" });

export const associarEspecialidades = (profissionalId, especialidadeIds) =>
  request(`/profissionais/${profissionalId}/especialidades`, {
    method: "POST",
    body: { especialidade_ids: especialidadeIds },
  });
export const desassociarEspecialidades = (profissionalId, especialidadeIds) => {
  const params = new URLSearchParams();
  especialidadeIds.forEach((id) => params.append("especialidade_ids", String(id)));
  return request(
    `/profissionais/${profissionalId}/especialidades?${params.toString()}`,
    { method: "DELETE" }
  );
};

// Disponibilidades / Agenda (UC07 e UC08)
export const listarDisponibilidades = (profissionalId) =>
  request(`/profissionais/${profissionalId}/disponibilidades`);
export const adicionarDisponibilidade = (profissionalId, dados) =>
  request(`/profissionais/${profissionalId}/disponibilidades`, {
    method: "POST",
    body: dados,
  });
export const substituirDisponibilidades = (profissionalId, lista) =>
  request(`/profissionais/${profissionalId}/disponibilidades`, {
    method: "PUT",
    body: lista,
  });
export const atualizarDisponibilidade = (id, dados) =>
  request(`/disponibilidades/${id}`, { method: "PUT", body: dados });
export const removerDisponibilidade = (id) =>
  request(`/disponibilidades/${id}`, { method: "DELETE" });
export const buscarHorariosDisponiveis = (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      params.set(k, String(v));
    }
  });
  const qs = params.toString();
  return request(`/disponibilidades/busca${qs ? `?${qs}` : ""}`);
};

