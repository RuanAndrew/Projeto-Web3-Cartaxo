import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const adminNavigation = [
  {
    label: "Profissionais",
    path: "/admin/profissionais",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    label: "Especialidades",
    path: "/admin/especialidades",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: "Configurar Agenda",
    path: "/admin/agenda",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
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
              <strong className="nav-title">{item.label}</strong>
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
            className={({ isActive }) =>
              `nav-link ${isActive ? "nav-link-active" : ""}`
            }
          >
            <span className="nav-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <strong className="nav-title">Área Médica</strong>
          </NavLink>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer-card">
          <div className="sidebar-profile">
            <div className="profile-avatar">AD</div>

            <div className="profile-copy">
              <strong>Administração</strong>
              <small>Admin da clínica</small>
            </div>
          </div>

          <Link className="sidebar-logout" to="/">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Trocar perfil</span>
          </Link>
        </div>
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
