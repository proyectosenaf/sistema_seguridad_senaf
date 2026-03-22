export const SUPPORT_AUDIENCES = {
  ADMIN: "admin",
  ROLES: "roles",
  VISITOR: "visitor",
};

export const SUPPORT_DOCS = [
  {
    slug: "manual-admin",
    title: "Manual de Administrador",
    audience: SUPPORT_AUDIENCES.ADMIN,
    description: "Guía completa para administración del sistema SENAF.",
    folder: "admin",
  },
  {
    slug: "manual-roles",
    title: "Manual de Usuarios y Roles",
    audience: SUPPORT_AUDIENCES.ROLES,
    description:
      "Guía de uso para usuarios internos según roles y permisos.",
    folder: "roles",
  },
  {
    slug: "manual-visitante",
    title: "Manual de Visitante",
    audience: SUPPORT_AUDIENCES.VISITOR,
    description:
      "Guía práctica para visitantes y usuarios de agenda o QR.",
    folder: "visitor",
  },
];

export const ALLOWED_SUPPORT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".md",
  ".txt",
];

export const SUPPORT_BASE_UPLOAD_DIR = "uploads/support";

export const SUPPORT_CONTACT = {
  email: "proyectosenaf@gmail.com",
  chatLabel: "Abrir chat",
  docsLabel: "Documentación",
};