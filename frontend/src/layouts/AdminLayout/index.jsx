import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { sair } from "../../services/autenticacao.js";

const adminNavigation = [
  {
    label: "Profissionais",
    description: "Cadastro, especialidades e status",
    path: "/admin/profissionais",
    icon: "✚",
  },
  {
    label: "Especialidades",
    description: "Catálogo de áreas clínicas",
    path: "/admin/especialidades",
    icon: "✦",
  },
  {
    label: "Configurar Agenda",
    description: "Dias e horários de atendimento",
    path: "/admin/agenda",
    icon: "◷",
  },
];

const TITLES = {
  "/admin/profissionais": "Gestão de Profissionais",
  "/admin/especialidades": "Gestão de Especialidades",
  "/admin/agenda": "Configuração de Agenda",
};

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const pageTitle = TITLES[location.pathname] || "Painel Administrativo";

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <div className="doctor-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`doctor-sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <Link
          to="/admin/profissionais"
          className="brand"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-symbol">C</span>

          <span className="brand-copy">
            <strong>Clínica</strong>
            <small>Painel administrativo</small>
          </span>
        </Link>

        <div className="sidebar-section-label">ADMINISTRAÇÃO</div>

        <nav className="doctor-navigation" aria-label="Navegação administrativa">
          {adminNavigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>

              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section-label sidebar-section-spaced">
          ATALHOS
        </div>

        <nav className="doctor-navigation" aria-label="Atalhos">
          <NavLink
            to="/agenda"
            onClick={() => setMenuOpen(false)}
            className="nav-link"
          >
            <span className="nav-icon" aria-hidden="true">
              ▤
            </span>
            <span className="nav-copy">
              <strong>Área Clínica</strong>
              <small>Agenda e prontuários</small>
            </span>
          </NavLink>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-profile">
          <div className="profile-avatar">AD</div>

          <div className="profile-copy">
            <strong>Administração</strong>
            <small>Gestão da clínica</small>
          </div>
        </div>

        <Link className="sidebar-logout" to="/" onClick={() => { sair(); }}>
          <span aria-hidden="true">↪</span>
          Trocar perfil
        </Link>
      </aside>

      <div className="doctor-main">
        <header className="doctor-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ☰
            </button>

            <div>
              <p className="topbar-context">Painel administrativo</p>
              <h1 className="topbar-title">{pageTitle}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <span className="topbar-date">{formattedDate}</span>
            <div className="topbar-avatar">AD</div>
          </div>
        </header>

        <main className="doctor-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

