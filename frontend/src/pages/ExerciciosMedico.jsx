import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Card from "../components/Card.jsx";
import Btn from "../components/Btn.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import { obterToken } from "../utils/auth.js";

// Ajuste a URL caso o serviço de exercícios rode em outra porta ou via API Gateway
const EXERCICIOS_API =
  import.meta.env.VITE_EXERCICIOS_URL || "http://localhost:8000";

const CATEGORIAS = ["Alongamento", "Fortalecimento", "Mobilidade", "Postural"];

const formInicial = {
  nome: "",
  categoria: "Alongamento",
  descricao: "",
  instrucoes: "",
  url_midia: "",
};

export default function ExerciciosMedico() {
  const { showToast } = useToast();

  const [exercicios, setExercicios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState(formInicial);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

  async function carregarExercicios() {
    setCarregando(true);
    try {
      const token = obterToken();
      const { data } = await axios.get(`${EXERCICIOS_API}/exercicios`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setExercicios(Array.isArray(data) ? data : data.items || []);
    } catch (error) {
      showToast(
        error.response?.data?.detail ||
          "Não foi possível carregar os exercícios."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarExercicios();
  }, []);

  function iniciarEdicao(exercicio) {
    setEditandoId(exercicio.id);
    setForm({
      nome: exercicio.nome || "",
      categoria: exercicio.categoria || "Alongamento",
      descricao: exercicio.descricao || "",
      instrucoes: exercicio.instrucoes || "",
      url_midia: exercicio.url_midia || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(formInicial);
  }

  async function salvarExercicio(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const token = obterToken();
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const payload = {
        ...form,
        url_midia: form.url_midia.trim() || null,
      };

      if (editandoId) {
        await axios.put(`${EXERCICIOS_API}/exercicios/${editandoId}`, payload, {
          headers,
        });
        showToast("Exercício atualizado com sucesso.");
      } else {
        await axios.post(`${EXERCICIOS_API}/exercicios`, payload, { headers });
        showToast("Exercício cadastrado e liberado para os pacientes.");
      }

      cancelarEdicao();
      await carregarExercicios();
    } catch (error) {
      showToast(
        error.response?.data?.detail || "Erro ao salvar o exercício."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluirExercicio(id) {
    if (!window.confirm("Deseja realmente excluir este exercício?")) return;
    try {
      const token = obterToken();
      await axios.delete(`${EXERCICIOS_API}/exercicios/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast("Exercício removido com sucesso.");
      await carregarExercicios();
    } catch (error) {
      showToast(
        error.response?.data?.detail || "Erro ao excluir o exercício."
      );
    }
  }

  const exerciciosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return exercicios.filter((item) => {
      const bateCategoria =
        categoriaFiltro === "Todas" || item.categoria === categoriaFiltro;
      const bateBusca =
        !termo ||
        item.nome?.toLowerCase().includes(termo) ||
        item.descricao?.toLowerCase().includes(termo) ||
        item.categoria?.toLowerCase().includes(termo);
      return bateCategoria && bateBusca;
    });
  }, [exercicios, busca, categoriaFiltro]);

  return (
    <main className="patient-admin page-stack">
      {/* Formulário de Criação / Edição pelo Médico */}
      <section className="card patient-form-card">
        <header className="patient-card-top">
          <div className="patient-card-top-left">
            <span className="patient-card-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6.5 6.5h11" />
                <path d="M6.5 17.5h11" />
                <path d="M3 10v4" />
                <path d="M21 10v4" />
                <path d="M6 8v8" />
                <path d="M18 8v8" />
              </svg>
            </span>
            <div>
              <h2 className="card-title">
                {editandoId
                  ? "Editar exercício prescrito"
                  : "Prescrever novo exercício"}
              </h2>
            </div>
          </div>

          {editandoId && (
            <span className="patient-editing-badge">Modo edição</span>
          )}
        </header>

        <form className="patient-structured-form" onSubmit={salvarExercicio}>
          <div className="patient-form-section">
            <div className="patient-form-section-title">
              <span className="patient-section-num">1</span>
              <strong>Identificação do exercício</strong>
            </div>

            <div className="patient-grid patient-grid-contact">
              <label className="patient-field patient-span-2">
                <span>
                  Nome do exercício <abbr title="Obrigatório">*</abbr>
                </span>
                <input
                  required
                  placeholder="Ex.: Alongamento cervical lateral"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </label>

              <label className="patient-field">
                <span>
                  Categoria <abbr title="Obrigatório">*</abbr>
                </span>
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="patient-form-section">
            <div className="patient-form-section-title">
              <span className="patient-section-num">2</span>
              <strong>Orientação clínica e execução</strong>
            </div>

            <div className="patient-grid">
              <label className="patient-field patient-span-2">
                <span>
                  Descrição / Objetivo clínico <abbr title="Obrigatório">*</abbr>
                </span>
                <input
                  required
                  placeholder="Ex.: Alívio de tensão na região do trapézio e pescoço"
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                />
              </label>

              <label className="patient-field patient-span-2">
                <span>
                  Instruções detalhadas (séries, repetições e postura){" "}
                  <abbr title="Obrigatório">*</abbr>
                </span>
                <textarea
                  required
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color, #d1d5db)",
                    fontFamily: "inherit",
                  }}
                  placeholder="Descreva passo a passo como o paciente deve realizar o movimento, quantidade de séries e tempo de descanso..."
                  value={form.instrucoes}
                  onChange={(e) =>
                    setForm({ ...form, instrucoes: e.target.value })
                  }
                />
              </label>

              <label className="patient-field patient-span-2">
                <span>Link de vídeo ou imagem demonstrativa (opcional)</span>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={form.url_midia}
                  onChange={(e) =>
                    setForm({ ...form, url_midia: e.target.value })
                  }
                />
              </label>
            </div>
          </div>

          <div className="patient-form-footer">
            <span className="patient-required-hint">
              Campos marcados com <strong>*</strong> são obrigatórios
            </span>

            <div className="patient-form-buttons">
              {editandoId ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelarEdicao}
                >
                  Cancelar edição
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setForm(formInicial)}
                >
                  Limpar campos
                </button>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={salvando}
              >
                {salvando
                  ? "Salvando..."
                  : editandoId
                    ? "Salvar alterações"
                    : "+ Salvar e publicar exercício"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Grade de Cards dos Exercícios Cadastrados */}
      <Card>
        <div className="records-Directory-header">
          <div className="records-directory-title-group">
            <h3 className="card-title">Exercícios cadastrados</h3>
            <span className="records-count-badge">
              {exerciciosFiltrados.length} exercício(s)
            </span>
          </div>

          <div className="records-directory-controls">
            <div
              className="records-specialty-pills"
              role="group"
              aria-label="Filtrar por categoria"
            >
              {["Todas", ...CATEGORIAS].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`records-filter-pill ${
                    categoriaFiltro === cat ? "records-filter-pill-active" : ""
                  }`}
                  onClick={() => setCategoriaFiltro(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <label className="search-field records-search-field">
              <span className="search-symbol" aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                aria-label="Buscar exercício"
                placeholder="Buscar por nome ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
          </div>
        </div>

        {carregando ? (
          <p className="receitas-feedback" role="status">
            Carregando exercícios...
          </p>
        ) : exerciciosFiltrados.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">⌕</span>
            <strong>Nenhum exercício encontrado</strong>
            <p>
              Utilize o formulário acima para descrever um novo exercício ou
              ajuste os filtros.
            </p>
          </div>
        ) : (
          <div className="patient-records-grid">
            {exerciciosFiltrados.map((ex) => (
              <article className="patient-record-card" key={ex.id}>
                <div className="patient-record-card-main">
                  <div className="patient-record-info">
                    <div className="patient-record-name-line">
                      <strong>{ex.nome}</strong>
                      <span className="patient-record-badge patient-record-badge-specialty">
                        {ex.categoria}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: "0.4rem 0",
                        fontSize: "0.9rem",
                        color: "var(--text-secondary, #4b5563)",
                      }}
                    >
                      {ex.descricao}
                    </p>

                    <small className="patient-record-meta">
                      <strong>Instruções:</strong> {ex.instrucoes}
                    </small>
                  </div>
                </div>

                <div
                  className="patient-record-card-action"
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  {ex.url_midia && (
                    <a
                      href={ex.url_midia}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      Ver mídia ↗
                    </a>
                  )}
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => iniciarEdicao(ex)}
                  >
                    Editar
                  </Btn>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => excluirExercicio(ex.id)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}