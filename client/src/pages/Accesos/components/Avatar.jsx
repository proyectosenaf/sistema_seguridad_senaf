export default function Avatar({ url, name }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || "avatar"}
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover"
      />
    );
  }

  const initials = (name || "—")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full grid place-items-center text-[11px] sm:text-xs font-semibold"
      style={{
        background: "color-mix(in srgb, var(--panel) 76%, transparent)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      {initials || "—"}
    </div>
  );
}