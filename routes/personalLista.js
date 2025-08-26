const express = require("express");
const db = require("../config/db");
const router = express.Router();

router.get("/listaPagos", async (req, res) => {
  const { gestion, rol, sucursal } = req.query;

  try {
    const result = await db.query(
      `
      SELECT p.id AS personal_id, p.nombres, p.apellidop, p.apellidom, p.ci,
             c.id AS contrato_id, c.sucursal, c.sueldo_mensual, c.fecha_inicio, c.fecha_fin,
             hr.tipo_personal AS rol
      FROM personal p
      JOIN contratos c ON c.id_personal = p.id
      JOIN historial_roles hr ON c.id_historial_rol = hr.id
      WHERE c.gestion = $1
        AND ($2::varchar IS NULL OR hr.tipo_personal = $2)
        AND ($3::varchar IS NULL OR c.sucursal = $3)
      ORDER BY p.apellidop, c.fecha_inicio DESC
    `,
      [gestion, rol || null, sucursal || null]
    );

    // Para cada contrato busca sus pagos
    const contratos = result.rows;
    for (const contrato of contratos) {
      const pagos = await db.query(
        `
        SELECT mes, SUM(monto_pagado) AS total
        FROM pagos_personal
        WHERE id_contrato = $1
        GROUP BY mes
      `,
        [contrato.contrato_id]
      );

      contrato.pagos = Array(12)
        .fill(0)
        .map((_, i) => {
          const pagoMes = pagos.rows.find((p) => p.mes == i + 1);
          return {
            mes: i + 1,
            monto: pagoMes ? parseFloat(pagoMes.total) : 0,
          };
        });
    }

    // Agrupa por personal
    const agrupado = {};
    contratos.forEach((c) => {
      const key = c.personal_id;
      if (!agrupado[key]) {
        agrupado[key] = {
          nombre_ci: `${c.apellidop} ${c.apellidom}, ${c.nombres}`,
          ci: `${c.ci}`,
          contratos: [],
        };
      }
      agrupado[key].contratos.push({
        rol: c.rol,
        sucursal: c.sucursal,
        sueldo: c.sueldo_mensual,
        inicio_fin: `${new Date(c.fecha_inicio).toLocaleDateString("es-BO", {
          month: "short",
          year: "numeric",
        })} - ${new Date(c.fecha_fin).toLocaleDateString("es-BO", {
          month: "short",
          year: "numeric",
        })}`,
        fecha_inicio: c.fecha_inicio, // 🔑 agrega esto
        fecha_fin: c.fecha_fin, // 🔑 agrega esto
        pagos: c.pagos,
      });
    });

    const listaOrdenada = Object.values(agrupado).sort((a, b) => {
      return a.nombre_ci.localeCompare(b.nombre_ci, "es", {
        sensitivity: "base",
      });
    });

    res.json(listaOrdenada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener lista de pagos" });
  }
});

module.exports = router;
