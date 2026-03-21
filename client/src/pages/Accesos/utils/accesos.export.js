export function exportarRegistrosCsv(records = []) {
  const lista = Array.isArray(records) ? records : [];

  if (!lista.length) {
    alert("No hay registros para exportar.");
    return;
  }

  const entradas = lista.filter(
    (r) => r.tipo === "Entrada" || r.tipo === "Salida"
  );
  const permisos = lista.filter((r) => r.tipo === "Permiso");

  const headerEntradas = [
    "Fecha/Hora",
    "Tipo",
    "Empleado",
    "Placa",
    "Observación",
    "Departamento",
  ];

  const filasEntradas = entradas.map((r) => [
    r.fechaHora || "",
    r.tipo || "",
    r.persona || "",
    r.placa || "",
    r.observacion || "",
    r.departamento || "",
  ]);

  const headerPermisos = [
    "Hora salida",
    "Hora regreso",
    "No regresa",
    "Empleado",
    "Placa",
    "Observación",
    "Departamento",
  ];

  const filasPermisos = permisos.map((r) => [
    r.fechaHora || "",
    r.noRegresa ? "" : r.fechaFin || "",
    r.noRegresa ? "X" : "",
    r.persona || "",
    r.placa || "",
    r.observacion || "",
    r.departamento || "",
  ]);

  const lines = [];
  lines.push(headerEntradas.map((h) => `"${h}"`).join(","));

  filasEntradas.forEach((f) => {
    lines.push(
      f.map((item) => `"${String(item || "").replace(/\"/g, '""')}"`).join(",")
    );
  });

  if (filasEntradas.length && filasPermisos.length) lines.push("");

  if (filasPermisos.length) {
    lines.push(headerPermisos.map((h) => `"${h}"`).join(","));
    filasPermisos.forEach((f) => {
      lines.push(
        f.map((item) => `"${String(item || "").replace(/\"/g, '""')}"`).join(",")
      );
    });
  }

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "historial_movimientos.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportarRegistrosPdf(records = []) {
  const lista = Array.isArray(records) ? records : [];

  if (!lista.length) {
    alert("No hay registros para exportar.");
    return;
  }

  const entradas = lista.filter(
    (r) => r.tipo === "Entrada" || r.tipo === "Salida"
  );
  const permisos = lista.filter((r) => r.tipo === "Permiso");

  let entradasHtml = "";
  if (entradas.length) {
    const headerEntradasHtml =
      `<tr>` +
      `<th>Fecha/Hora</th>` +
      `<th>Tipo</th>` +
      `<th>Empleado</th>` +
      `<th>Placa</th>` +
      `<th>Observación</th>` +
      `<th>Departamento</th>` +
      `</tr>`;

    const rowsEntradasHtml = entradas
      .map(
        (r) =>
          `<tr>` +
          `<td>${r.fechaHora || ""}</td>` +
          `<td>${r.tipo || ""}</td>` +
          `<td>${r.persona || ""}</td>` +
          `<td>${r.placa || ""}</td>` +
          `<td>${r.observacion || ""}</td>` +
          `<td>${r.departamento || ""}</td>` +
          `</tr>`
      )
      .join("");

    entradasHtml =
      `<h2>Entradas y salidas</h2>` +
      `<table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">${headerEntradasHtml}${rowsEntradasHtml}</table>`;
  }

  let permisosHtml = "";
  if (permisos.length) {
    const headerPermisosHtml =
      `<tr>` +
      `<th>Hora salida</th>` +
      `<th>Hora regreso</th>` +
      `<th>No regresa</th>` +
      `<th>Empleado</th>` +
      `<th>Placa</th>` +
      `<th>Observación</th>` +
      `<th>Departamento</th>` +
      `</tr>`;

    const rowsPermisosHtml = permisos
      .map(
        (r) =>
          `<tr>` +
          `<td>${r.fechaHora || ""}</td>` +
          `<td>${r.noRegresa ? "" : r.fechaFin || ""}</td>` +
          `<td>${r.noRegresa ? "X" : ""}</td>` +
          `<td>${r.persona || ""}</td>` +
          `<td>${r.placa || ""}</td>` +
          `<td>${r.observacion || ""}</td>` +
          `<td>${r.departamento || ""}</td>` +
          `</tr>`
      )
      .join("");

    permisosHtml =
      `<h2>Permisos</h2>` +
      `<table style="width:100%; border-collapse: collapse;">${headerPermisosHtml}${rowsPermisosHtml}</table>`;
  }

  const win = window.open("", "", "width=1000,height=600");
  if (!win) return;

  win.document.write(
    `<html><head><title>Historial de movimientos manuales</title><style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
      h1, h2 { color: #2c3e50; margin-top: 20px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background-color: #2c3e50; color: #ecf0f1; padding: 8px; font-size: 12px; }
      td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
      tr:nth-child(even) td { background-color: #f9f9f9; }
      tr:nth-child(odd) td { background-color: #ffffff; }
    </style></head><body>`
  );

  win.document.write(`<h1>Historial de movimientos manuales</h1>`);
  if (entradasHtml) win.document.write(entradasHtml);
  if (permisosHtml) win.document.write(permisosHtml);
  win.document.write("</body></html>");
  win.document.close();
  win.focus();
}