# ============================
# ⚙️ CONFIGURACIÓN GENERAL
# ============================
NODE_ENV=production
PORT=8080
API_PORT=8080

# ============================
# 🗄️ BASE DE DATOS
# ============================
MONGODB_URI="mongodb+srv://proyectosenaf_db_user:SENAFdb2025@senafcluster.vwwt8sy.mongodb.net/senafseg?retryWrites=true&w=majority"

# ============================
# 🔐 AUTH0 - TENANT NUEVO
# ============================
AUTH0_DOMAIN=dev-0046gqmh011jo75x.us.auth0.com
AUTH0_AUDIENCE=https://senaf
AUTH0_CLIENT_ID=0inHCmH5bc4syvHIuFNEr5uvRbKrWCGe
AUTH0_CLIENT_SECRET=geCqx-w2-moNKMWBp1S7QY3lOVMrgSwvI_J2xS3d5TRJQrXAYT_LB0CML7YCFf2l

# Namespace para roles/permisos
IAM_ROLES_NAMESPACE=https://senaf.local/roles

# 🔑 Super administradores (correos Auth0)
ROOT_ADMINS=proyectosenaf@gmail.com

# Dev headers desactivados en producción
IAM_ALLOW_DEV_HEADERS=0
IAM_DEV_ALLOW_ALL=0

# No desactivar auth en producción
DISABLE_AUTH=0

# ============================
# 🌐 CORS / FRONTEND
# ============================
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,https://urchin-app-fuirh.ondigitalocean.app

# ============================
# 📧 EMAIL
# ============================
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=1
MAIL_USER=proyectosenaf@gmail.com
MAIL_PASS=Seguridad.2025
MAIL_FROM="SENAF Seguridad <proyectosenaf@gmail.com>"

VERIFY_BASE_URL=https://urchin-app-fuirh.ondigitalocean.app/verify

# ============================
# 🕒 RONDAS QR
# ============================
RONDASQR_QR_SECRET=dev_super_secret
RONDASQR_QR_OUT=qr_seeds
RONDASQR_LATE_THRESHOLD=180
RONDASQR_IMMOBILITY_MINUTES=60
RONDASQR_API_PREFIX=/api/rondasqr/v1

# ============================
# 📝 LOGS / NOMBRE APP
# ============================
APP_NAME="SENAF Seguridad"
APP_LOG_LEVEL=info
