import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const token = () => localStorage.getItem("access_token") || "";
const cpfMask = (v) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const phoneMask = (v) => { const n = v.replace(/\D/g, "").slice(0, 11); return n.length > 10 ? n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : n.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3"); };
async function api(path, options = {}) {
  try {
    const response = await axios.request({ baseURL: API, url: `/api/v1/pacientes${path}`, ...options, headers: { "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers } });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.detail || error.message || "Falha na comunicação com a API");
  }
}

const empty = { nome_completo: "", cpf: "", data_nascimento: "", sexo: "NAO_INFORMAR", telefone_principal: "", telefone_secundario: "", email: "", user_account_id: "", endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" } };

export function Pacientes() {
  const [filters, setFilters] = useState({ busca: "", ativo: "true" });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(empty); const [editing, setEditing] = useState(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const qs = new URLSearchParams({ page, limit: 20, ...(filters.busca ? { busca: filters.busca } : {}), ...(filters.ativo ? { ativo: filters.ativo } : {}) });
  const { data = { items: [], total: 0, page, limit: 20 }, error: queryError } = useQuery({ queryKey: ["pacientes", filters, page], queryFn: () => api(`?${qs}`) });
  useEffect(() => { setPage(1); }, [filters]);
  function startEdit(patient) { setEditing(patient.id); setForm({ ...patient, cpf: cpfMask(patient.cpf), data_nascimento: patient.data_nascimento, endereco: patient.endereco || empty.endereco }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = { ...form, cpf: form.cpf.replace(/\D/g, ""), user_account_id: form.user_account_id || null, endereco: Object.values(form.endereco).some(Boolean) ? Object.fromEntries(Object.entries(form.endereco).map(([key, value]) => [key, value || null])) : null, telefone_secundario: form.telefone_secundario || null, email: form.email || null };
      await api(editing ? `/${editing}` : "", { method: editing ? "PUT" : "POST", data: payload }); setForm(empty); setEditing(null); await queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function deactivate(id) { if (!window.confirm("Inativar este cadastro?")) return; try { await api(`/${id}/inativar`, { method: "PATCH" }); await queryClient.invalidateQueries({ queryKey: ["pacientes"] }); } catch (e) { setError(e.message); } }
  return <main className="patient-admin page-stack">
    <header className="page-heading"><div><span className="eyebrow">CADASTRO</span><h1 className="page-title">Pacientes</h1><p className="page-subtitle">Consulte e mantenha os dados cadastrais dos pacientes.</p></div></header>
    {(error || queryError?.message) && <p role="alert" className="patient-error">{error || queryError?.message}</p>}
    <section className="card"><header className="card-header"><div><h2 className="card-title">{editing ? "Editar paciente" : "Novo paciente"}</h2><p className="card-description">Os dados são protegidos e acessíveis conforme o perfil de cada usuário.</p></div></header>
      <form className="patient-form" onSubmit={save}>
        <label>Nome completo<input required minLength="2" value={form.nome_completo} onChange={e => setForm({ ...form, nome_completo: e.target.value })}/></label>
        <label>CPF<input required inputMode="numeric" value={form.cpf} onChange={e => setForm({ ...form, cpf: cpfMask(e.target.value) })}/></label>
        <label>Data de nascimento<input required type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })}/></label>
        <label>Sexo<select value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}><option value="NAO_INFORMAR">Prefiro não informar</option><option value="FEMININO">Feminino</option><option value="MASCULINO">Masculino</option><option value="OUTRO">Outro</option></select></label>
        <label>Telefone principal<input required inputMode="tel" value={form.telefone_principal} onChange={e => setForm({ ...form, telefone_principal: phoneMask(e.target.value) })}/></label>
        <label>Telefone secundário<input inputMode="tel" value={form.telefone_secundario || ""} onChange={e => setForm({ ...form, telefone_secundario: phoneMask(e.target.value) })}/></label>
        <label>E-mail<input type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
        <label className="patient-wide">ID da conta do usuário (UUID)<input value={form.user_account_id || ""} onChange={e => setForm({ ...form, user_account_id: e.target.value })}/></label>
        <label>CEP<input inputMode="numeric" maxLength="9" value={form.endereco?.cep || ""} onChange={e => setForm({ ...form, endereco: { ...form.endereco, cep: e.target.value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2") } })}/></label>
        <label className="patient-wide">Logradouro<input value={form.endereco?.logradouro || ""} onChange={e => setForm({ ...form, endereco: { ...form.endereco, logradouro: e.target.value } })}/></label>
        <label>Número<input value={form.endereco?.numero || ""} onChange={e => setForm({ ...form, endereco: { ...form.endereco, numero: e.target.value } })}/></label>
        <label>Bairro<input value={form.endereco?.bairro || ""} onChange={e => setForm({ ...form, endereco: { ...form.endereco, bairro: e.target.value } })}/></label>
        <label>Cidade<input value={form.endereco?.cidade || ""} onChange={e => setForm({ ...form, endereco: { ...form.endereco, cidade: e.target.value } })}/></label>
        <label>UF<input maxLength="2" value={form.endereco?.uf || ""} onChange={e => setForm({ ...form, endereco: { ...form.endereco, uf: e.target.value.toUpperCase() } })}/></label>
        <div className="patient-form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar paciente"}</button>{editing && <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}</div>
      </form>
    </section>
    <section className="card"><div className="patient-filters"><input aria-label="Buscar por nome ou CPF" placeholder="Buscar por nome ou CPF" value={filters.busca} onChange={e => setFilters({ ...filters, busca: e.target.value })}/><select aria-label="Filtrar situação" value={filters.ativo} onChange={e => setFilters({ ...filters, ativo: e.target.value })}><option value="true">Ativos</option><option value="false">Inativos</option><option value="">Todos</option></select><span>{data.total} cadastro(s)</span></div>
      <div className="patient-table-wrap"><table className="patient-table"><thead><tr><th>Paciente</th><th>CPF</th><th>Telefone</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{data.items.map(p => <tr key={p.id}><td>{p.nome_completo}</td><td>{cpfMask(p.cpf)}</td><td>{p.telefone_principal}</td><td>{p.ativo ? "Ativo" : "Inativo"}</td><td><button className="btn btn-sm btn-outline" onClick={() => startEdit(p)}>Editar</button>{p.ativo && <button className="btn btn-sm btn-danger" onClick={() => deactivate(p.id)}>Inativar</button>}</td></tr>)}{!data.items.length && <tr><td colSpan="5">Nenhum cadastro encontrado.</td></tr>}</tbody></table></div>
      <div className="patient-pagination"><button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button className="btn btn-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(page + 1)}>Próxima</button></div>
    </section>
  </main>;
}

export function PatientProfile() {
  const [profile, setProfile] = useState(null); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { const id = localStorage.getItem("patient_id"); if (!id) { setError("Entre na sua conta para consultar seu perfil."); return; } api(`/${id}`).then(setProfile).catch(e => setError(e.message)); }, []);
  async function save(e) { e.preventDefault(); try { await api(`/${profile.id}`, { method: "PUT", data: { telefone_principal: profile.telefone_principal, telefone_secundario: profile.telefone_secundario || null, email: profile.email || null } }); setMessage("Contatos atualizados."); } catch (err) { setError(err.message); } }
  return <main className="page-stack"><header className="page-heading"><div><span className="eyebrow">MEU CADASTRO</span><h1 className="page-title">Meu perfil</h1></div></header>{error && <p role="alert" className="patient-error">{error}</p>}{message && <p role="status">{message}</p>}{profile && <section className="card"><h2 className="card-title">{profile.nome_completo}</h2><p>CPF: {cpfMask(profile.cpf)} · Nascimento: {profile.data_nascimento}</p><form className="patient-form" onSubmit={save}><label>Telefone principal<input required value={profile.telefone_principal} onChange={e => setProfile({ ...profile, telefone_principal: phoneMask(e.target.value) })}/></label><label>Telefone secundário<input value={profile.telefone_secundario || ""} onChange={e => setProfile({ ...profile, telefone_secundario: phoneMask(e.target.value) })}/></label><label>E-mail<input type="email" value={profile.email || ""} onChange={e => setProfile({ ...profile, email: e.target.value })}/></label><div className="patient-form-actions"><button className="btn btn-primary">Atualizar contatos</button></div></form></section>}</main>;
}
