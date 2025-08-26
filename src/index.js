const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

//Importar Rutas
const usuariosRoutes = require("../routes/usuarios");
const estudiantesRoutes = require("../routes/estudiantes");
const inscripcionesRoutes = require("../routes/inscripciones");
const encargadosRoutes = require("../routes/encargados");
const estudiantes_encargadosRoutes = require("../routes/estudiantes_encargados");
const pagosRoutes = require("../routes/pagos");
const recibosRoutes = require("../routes/recibos");
const tarifas_personalizdasRoutes = require("../routes/tarifas_personalizadas");
const tarifasRoutes = require("../routes/tarifas");
const loginRoutes = require("../routes/login");
const sendEmail = require("../routes/send-email");
const recoverPasswordRoutes = require("../routes/recoverPassword");
const listadoEstudiantes = require("../routes/reportes/listado-estudiantes");
const descuentosEstudiantes = require("../routes/reportes/estudiantes-descuentos");
const reporteInscripcion = require("../routes/reportes/estudiantes-reinscripcion");
const inscripcionAnios = require("../routes/reportes/inscripcion-anios");
const listaPagos = require("../routes/listaPagos");
const notificacionesRoutes = require("../routes/notificaciones");
const crear_tarifas = require("../routes/crear_tarifa");
const personal = require("../routes/personal");
const materias = require("../routes/materias");
const cursos = require("../routes/cursos");
const turnos = require("../routes/turnos");
const personalFiltrado = require("../routes/personalFiltrado");
const personalButtons = require("../routes/personalButtons");
const personalLista = require("../routes/personalLista");
const listadoPersonal = require("../routes/reportes/listado-personal");
const trabajoPersonal = require("../routes/reportes/trabajo-personal");
const turnosPersonal = require("../routes/reportes/turnos-personal");
const horariosProfesor = require("../routes/reportes/horarios-profesor");
const gestionTaller = require("../routes/gestion-taller");
const asignarTaller = require("../routes/asignar-taller");
const verTaller = require("../routes/ver-taller");
const gastos = require("../routes/gastos");
const gestionCompras = require("../routes/gestion-compras");
const venderCompras = require("../routes/vender-compras");
const pagosCompras = require("../routes/pagos-compras");
const dashboard = require("../routes/dashboard");
const tesoreria = require("../routes/tesoreria");
const creacion = require("../routes/creacion");
const especial = require("../routes/especial");

const app = express();
//app.use(cors());
//app.use(cors({ origin: true }));
app.use(
  cors({
    origin: [
      "http://localhost:4200", // frontend local (Angular)
      "https://proyecto-despertad-production.up.railway.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Ruta principal
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// Usar rutas de usuarios
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/estudiantes", estudiantesRoutes);
app.use("/api/inscripciones", inscripcionesRoutes);
app.use("/api/encargados", encargadosRoutes);
app.use("/api/estudiantes_encargados", estudiantes_encargadosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/recibos", recibosRoutes);
app.use("/api/tarifas_personalizadas", tarifas_personalizdasRoutes);
app.use("/api/tarifas", tarifasRoutes);
app.use("/api/login", loginRoutes);
app.use("/api/send-email", sendEmail);
app.use("/api/recover-password", recoverPasswordRoutes);
app.use("/api/reportes/estudiantes", listadoEstudiantes);
app.use("/api/reportes/descuentos", descuentosEstudiantes);
app.use("/api/reportes/inscripcion", reporteInscripcion);
app.use("/api/reportes/anios", inscripcionAnios);
app.use("/api/listaPagos", listaPagos);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/crear_tarifa", crear_tarifas);
app.use("/api/personal", personal);
app.use("/api/materias", materias);
app.use("/api/cursos", cursos);
app.use("/api/turnos", turnos);
app.use("/api/personalFiltrado", personalFiltrado);
app.use("/api/personalButtons", personalButtons);
app.use("/api/personalLista", personalLista);
app.use("/api/reportes/listaPersonal", listadoPersonal);
app.use("/api/reportes/trabajoPersonal", trabajoPersonal);
app.use("/api/reportes/turnosPersonal", turnosPersonal);
app.use("/api/reportes/horariosProfesor", horariosProfesor);
app.use("/api/gestionTaller", gestionTaller);
app.use("/api/asignarTaller", asignarTaller);
app.use("/api/verTaller", verTaller);
app.use("/api/gastos", gastos);
app.use("/api/gestionCompras", gestionCompras);
app.use("/api/venderCompras", venderCompras);
app.use("/api/pagosCompras", pagosCompras);
app.use("/api/dashboard", dashboard);
app.use("/api/tesoreria", tesoreria);
app.use("/api/creacion", creacion);
app.use("/api/especial", especial);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor despertad corriendo en puerto: ${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Error no capturado:", err);
});
