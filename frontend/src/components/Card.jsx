export default function Card({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || description || action) && (
        <header className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}

            {description && (
              <p className="card-description">{description}</p>
            )}
          </div>

          {action && <div className="card-header-action">{action}</div>}
        </header>
      )}

      <div className="card-body">{children}</div>
    </section>
  );
}