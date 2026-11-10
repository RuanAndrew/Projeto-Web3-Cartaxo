import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Btn from "../components/Btn.jsx";
import { ApiError } from "../utils/api.js";
import { rotaPorPerfil } from "../utils/auth.js";
import { entrar } from "../services/autenticacao.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [carregando, setCarregando] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Preencha o e-mail e a senha para continuar.");
      return;
    }

    setCarregando(true);
    try {
      const sessao = await entrar(email, password);
      navigate(rotaPorPerfil(sessao.usuario?.perfil));
    } catch (erro) {
      setError(
        erro instanceof ApiError
          ? erro.message
          : "Falha inesperada no login. Tente novamente."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">
          <span className="brand-symbol brand-symbol-light">C</span>

          <div>
            <strong>Clínica</strong>
            <small>Plataforma de gestão em saúde</small>
          </div>
        </div>

        <div className="login-visual-content">
          <span className="login-kicker">CUIDADO CONECTADO</span>

          <h1>
            Tecnologia a serviço de um cuidado mais humano.
          </h1>

          <p>
            Uma experiência integrada para profissionais de saúde e
            pacientes, do agendamento ao acompanhamento terapêutico.
          </p>

          <div className="login-feature-list">
            <div>
              <span className="feature-check">✓</span>
              <span>Organização da rotina clínica</span>
            </div>

            <div>
              <span className="feature-check">✓</span>
              <span>Acompanhamento do tratamento</span>
            </div>

            <div>
              <span className="feature-check">✓</span>
              <span>Histórico clínico centralizado</span>
            </div>
          </div>
        </div>

        <p className="login-visual-footer">
          Plataforma demonstrativa de gestão clínica.
        </p>
      </section>

      <section className="login-panel">
        <div className="login-form-wrapper">
          <div className="login-mobile-brand">
            <span className="brand-symbol">C</span>
            <strong>Clínica</strong>
          </div>

          <span className="eyebrow">SEJA BEM-VINDO</span>

          <h2 className="login-heading">Acesse sua conta</h2>

          <p className="login-subtitle">
            Informe suas credenciais: o sistema identifica o seu perfil e
            direciona você para a área correspondente.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="form-label" htmlFor="email">
              E-mail
            </label>

            <input
              id="email"
              className="form-input"
              type="email"
              autoComplete="username"
              placeholder="voce@clinica.dev"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label className="form-label" htmlFor="password">
              Senha
            </label>

            <input
              id="password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <Btn type="submit" className="login-submit" disabled={carregando}>
              {carregando
                ? "Entrando…"
                : "Entrar na plataforma"}{" "}
              <span aria-hidden="true">→</span>
            </Btn>
          </form>

          <div className="demo-notice">
            <span aria-hidden="true">ⓘ</span>
            <p>
              <strong>Contas de demonstração</strong> criadas pelo
              auth-service — administrador:{" "}
              <code>admin@clinica.dev</code> / <code>admin123</code>. Outros
              usuários precisam ser cadastrados por um administrador.
            </p>
          </div>

          <p className="login-legal">
            Ambiente acadêmico · Dados fictícios
          </p>
        </div>
      </section>
    </main>
  );
}
