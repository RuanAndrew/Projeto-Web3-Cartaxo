import { useEffect, useRef, useState } from "react";

export function normalizarTextoBusca(texto = "") {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function iniciaisDeNome(nome = "") {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zÀ-ÿ]/g, ""))
    .filter(Boolean);
  if (partes.length === 0) return "PR";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

export function gerarSlotsComerciais(duracaoMinutos = 15) {
  const duracao = Number(duracaoMinutos) === 20 ? 20 : 15;
  const inicioMin = 8 * 60; // 08:00
  const fimMin = 17 * 60; // 17:00
  const slots = [];

  for (let min = inicioMin; min + duracao <= fimMin; min += duracao) {
    const hIni = String(Math.floor(min / 60)).padStart(2, "0");
    const mIni = String(min % 60).padStart(2, "0");
    const fimSlot = min + duracao;
    const hFim = String(Math.floor(fimSlot / 60)).padStart(2, "0");
    const mFim = String(fimSlot % 60).padStart(2, "0");
    const inicio = `${hIni}:${mIni}`;
    const fim = `${hFim}:${mFim}`;
    slots.push({
      key: `${inicio}-${fim}`,
      inicio,
      fim,
      label: `${inicio} – ${fim}`,
      turno: min < 12 * 60 ? "MANHA" : "TARDE",
    });
  }

  return slots;
}

export default function SearchableCombobox({
  id,
  label,
  placeholder = "Pesquisar...",
  value,
  options = [],
  selectedOption = null,
  onSelect,
  onSearchChange,
  searching = false,
  emptyMessage = "Nenhum resultado encontrado.",
  hintText = "Digite para pesquisar",
  allowClear = true,
  className = "",
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
    <div className={`doctor-combobox ${className}`} ref={containerRef}>
      {label && (
        <label className="doctor-combobox-label" htmlFor={id}>
          {label}
        </label>
      )}

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
            placeholder={selectedOption ? selectedOption.label : placeholder}
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

        {allowClear && value && (
          <button
            type="button"
            className="doctor-combobox-clear"
            aria-label="Limpar seleção"
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
          aria-label="Abrir lista de opções"
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
                  <li key={item.value || `opt-${idx}`}>
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
                        {item.initials || "PR"}
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
