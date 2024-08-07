const express = require('express');
const router = express.Router();

const ID_MOD = "Render"

const SitioDAO = require('../../dao/sitioDAO');
const sitioDAO = new SitioDAO();

router.get('/', async (req, res) => {
  console.log(`${ID_MOD} - ${req.query}`);

  sitioDAO.getAll((err, rows) => {
    if (err) {
      console.error('Error fetching sitio:', err);
      res.status(500).send('Error interno del servidor');
    } else {
      res.json(rows); // Envía la respuesta como JSON con los registros obtenidos
    }
  });
});

router.get('/:id', async (req, res) => {
  console.log(`${ID_MOD} - ${req.body}`);
});

router.post('/', async (req, res) => {
  console.log(`${ID_MOD} - ${req.body}`);
});

router.put('/:id', async (req, res) => {
  console.log(`${ID_MOD} - ${req.body}`);
});

router.delete('/:id', async (req, res) => {
  console.log(`${ID_MOD} - ${req.body}`);
});

module.exports = router;