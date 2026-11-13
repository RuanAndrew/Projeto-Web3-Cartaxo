import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { sair } from "../../services/autenticacao.js";
import { useToast } from "../../components/ToastProvider.jsx";

const clinicalNavigation = [
  {
    label: "Agenda",
    path: "/agenda",
    end: true,
    icon: (
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
    ),
  },
  {
    label: "Prontuários",
    path: "/prontuarios",
    end: false,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
];

const upcomingModules = [
  {
    label: "Pacientes",
    badge: "Em breve",
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
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Relatórios",
    badge: "Em breve",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function DoctorLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { showToast } = useToast();
  const location = useLocation();

  const pageTitle = location.pathname.startsWith("/prontuario/")
    ? "Prontuário eletrônico"
    : location.pathname === "/prontuarios"
      ? "Prontuários"
      : "Agenda clínica";

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
          to="/agenda"
          className="brand"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-symbol">C</span>

          <span className="brand-copy">
            <span className="brand-title-row">
              <strong>Clínica</strong>
              <span className="workspace-role-tag workspace-role-tag-doctor">
                Médico
              </span>
            </span>
            <small>Área clínica</small>
          </span>
        </Link>

        <div className="sidebar-section-label">ÁREA CLÍNICA</div>

        <nav className="doctor-navigation" aria-label="Navegação clínica">
          {clinicalNavigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
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
          ADMINISTRAÇÃO
        </div>

        <nav className="doctor-navigation" aria-label="Administração">
          <NavLink
            to="/admin/profissionais"
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <strong className="nav-title">Painel Admin</strong>
          </NavLink>
        </nav>

        <div className="sidebar-section-label sidebar-section-spaced">
          OUTROS MÓDULOS
        </div>

        <div className="doctor-navigation">
          {upcomingModules.map((item) => (
            <div key={item.label} className="sidebar-coming-soon">
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <strong className="nav-title">{item.label}</strong>
              <span className="sidebar-soon-badge">{item.badge}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer-card">
          <div className="sidebar-profile">
            <div className="profile-avatar">MS</div>

            <div className="profile-copy">
              <strong>Mariana Santos</strong>
              <small>Médico(a)</small>
            </div>
          </div>

          <Link
            className="sidebar-logout"
            to="/"
            onClick={() => {
              sair();
            }}
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
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sair da conta</span>
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
              <p className="topbar-context">Espaço de trabalho</p>
              <h1 className="topbar-title">{pageTitle}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <span className="topbar-workspace-pill topbar-workspace-pill-doctor">
              <span className="topbar-workspace-dot" aria-hidden="true" />
              Modo Médico
            </span>
            <span className="topbar-date">{formattedDate}</span>

            <button
              type="button"
              className="notification-button"
              aria-label="Notificações demonstrativas"
              onClick={() =>
                showToast("As notificações serão integradas posteriormente.")
              }
            >
              ♧
            </button>

            <div className="topbar-avatar">MS</div>
          </div>
        </header>

        <main className="doctor-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
