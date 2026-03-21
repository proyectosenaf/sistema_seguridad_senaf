export function validateEmpleadoForm(form) {
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);

  if (!form.nombreCompleto.trim()) {
    errors.push("El nombre completo es obligatorio.");
  } else {
    const letters = form.nombreCompleto.replace(/[^A-Za-zÁÉÍÓÚáéíóúÜüñÑ]/g, "");
    if (letters.length < 8) {
      errors.push("El nombre completo debe tener al menos 8 letras.");
    }
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(form.nombreCompleto.trim())) {
      errors.push("El nombre completo solo debe contener letras y espacios.");
    }
  }

  if (!form.id_persona.trim()) {
    errors.push("El ID Persona es obligatorio.");
  } else if (!/^\d+$/.test(form.id_persona.trim())) {
    errors.push("El ID Persona solo debe contener números.");
  }

  if (!form.departamento.trim()) {
    errors.push("El área / departamento es obligatoria.");
  }

  if (!form.cargo.trim()) {
    errors.push("El cargo es obligatorio.");
  }

  if (!form.sexo || !form.sexo.trim()) {
    errors.push("El sexo es obligatorio.");
  }

  if (!form.dni || !form.dni.trim()) {
    errors.push("El DNI es obligatorio.");
  } else {
    const dniTrim = form.dni.trim();
    const dniPattern = /^\d{4}[-_]\d{4}[-_]\d{5}$/;
    if (!dniPattern.test(dniTrim)) {
      errors.push(
        "El DNI debe tener el formato dddd-dddd-ddddd o dddd_dddd_ddddd (solo números y guiones)."
      );
    }
  }

  if (!form.telefono || !form.telefono.trim()) {
    errors.push("El teléfono es obligatorio.");
  } else {
    const telTrim = form.telefono.trim();
    const telPattern = /^\d{4}[-_]\d{4}$/;
    if (!telPattern.test(telTrim)) {
      errors.push(
        "El teléfono debe tener el formato 1234-5678 o 1234_5678 (8 dígitos, separados por guión)."
      );
    }
  }

  if (!form.direccion || !form.direccion.trim()) {
    errors.push("La dirección es obligatoria.");
  } else {
    const direccionTrim = form.direccion.trim();
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÜüñÑ\s]+$/.test(direccionTrim)) {
      errors.push("La dirección solo debe contener letras y espacios.");
    }
  }

  if (!form.fechaNacimiento) {
    errors.push("La fecha de nacimiento es obligatoria.");
  } else if (form.fechaNacimiento > today) {
    errors.push("La fecha de nacimiento no puede ser futura.");
  }

  if (!form.fechaIngreso) {
    errors.push("La fecha de ingreso es obligatoria.");
  } else if (form.fechaIngreso > today) {
    errors.push("La fecha de ingreso no puede ser futura.");
  }

  if (
    form.fechaNacimiento &&
    form.fechaIngreso &&
    form.fechaIngreso < form.fechaNacimiento
  ) {
    errors.push(
      "La fecha de ingreso no puede ser anterior a la fecha de nacimiento."
    );
  }

  return errors;
}