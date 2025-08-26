const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado o inválido" });
  }

  const token = req.headers.authorization?.split(" ")[1]; 

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload; 
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
}

module.exports = verificarToken;