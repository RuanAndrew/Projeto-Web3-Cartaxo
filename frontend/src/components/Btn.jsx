export default function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  size = "medium",
  disabled = false,
  block = false,
  className = "",
}) {
  const classes = [
    "btn",
    `btn-${variant}`,
    size === "small" ? "btn-sm" : "",
    block ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}