const express = require("express");
const router = express.Router();
const personalController = require("../controllers/personal.controller");

router.post("/", personalController.crearPersonal);

router.get('/verificar-ci/:ci', personalController.verificarCI);

module.exports = router;