const pool = require("../config/db");

const insertarTarifas = async () => {
  const query = `
    INSERT INTO tarifas (gestion, grupo_tarifa_id, costo_matricula, costo_mensualidad) VALUES
      (2023, 1, 100, 800),
      (2023, 2, 150, 850),
      (2023, 3, 200, 900),
      (2024, 1, 120, 820),
      (2024, 2, 170, 870),
      (2024, 3, 220, 920)
    ON CONFLICT (gestion, grupo_tarifa_id) DO NOTHING;
  `;

  try {
    await pool.query(query);
    console.log("✅ Tarifas insertadas correctamente.");
  } catch (error) {
    console.error("❌ Error insertando tarifas:", error);
  } finally {
    pool.end();
  }
};

insertarTarifas();
