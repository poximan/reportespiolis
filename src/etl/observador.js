const fs = require("fs");
const readline = require("readline");

const config = require("../../config.json")
const { lanzarETL } = require("./etl");
const { lanzarReporte, notificarFallo } = require("../control/controlReporte")

const ID_MOD = "OBSERV";

const verLog = config.desarrollo.verLog
const dir_reporte = config.direcciones.sca_wizcon

let filePath = process.argv[2];
let currentModifiedTime;
let lastModifiedTime = null;
const checkInterval = 4 * 1000 * 10; // tiempo verificacion de cambios en milisegundos

let antes_hubo_error = false

function iniciar() {
  // Verifica que se haya proporcionado el archivo como argumento
  if (process.argv.length < 3) {
    console.error(
      `${ID_MOD} - No hay direccion en linea de comandos, se utilizara definicion de config.json`
    );

    filePath = dir_reporte
    checkFileModification();    
  }
}

/**
 * 
 * @param {*} enviarEmail 
 * @param {*} cb 
 */
function verUltimoCambio(enviarEmail, cb) {
  lanzarReporte(enviarEmail, currentModifiedTime, () => { cb() })
}

function parar() {
  clearInterval(intervalId);

  if (verLog)
    console.log(`${ID_MOD} - deteniendo observador`);
}

/* ===========================================================
===================== FUNCIONES INTERNAS =====================
==============================================================
*/

// Función para leer y procesar el archivo
function readAndProcessFile() {
  let lines = [];
  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      output: process.stdout,
      terminal: false,
    });

    // Escucha cada línea del archivo
    rl.on("line", (line) => {
      lines.push(line);
    });

    rl.on("close", () => {
      lanzarETL(lines, currentModifiedTime, () => {
        verUltimoCambio(true, () => { } )
      })
    });

  } catch (error) {
    console.error(`Error al leer el archivo: ${error.message}`);
  }
}

// Función para verificar la fecha de modificación del archivo
function checkFileModification() {
  fs.stat(filePath, (err, stats) => {
    
    if (err) 
      currentModifiedTime = new Date();
    else
      currentModifiedTime = stats.mtime;
    
    const fechaActual = formatoFecha(currentModifiedTime);
    const fechaAnterior = formatoFecha(lastModifiedTime);

    if (err && !antes_hubo_error) {
      antes_hubo_error = true
      console.log(`FALLO: Actual ${fechaActual} ==> Anterior ${fechaAnterior}`);
      notificarFallo(false, err.message, currentModifiedTime, () => { })
      return;
    }

    antes_hubo_error = false

    if (!lastModifiedTime || currentModifiedTime > lastModifiedTime) {
      
      lastModifiedTime = currentModifiedTime;      
      console.log(`EXITO: Actual ${fechaActual} ==> Anterior ${fechaAnterior}`);

      readAndProcessFile();
    } else {      
      if (verLog)
        console.log(`${ID_MOD} - El archivo no ha sido modificado desde la última lectura`);
    }
  });
}

// Función para formatear la fecha
function formatoFecha(fechaOriginal) {
  const fecha = new Date(fechaOriginal);

  // Obtiene los componentes de la fecha
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  const hours = String(fecha.getHours()).padStart(2, "0");
  const minutes = String(fecha.getMinutes()).padStart(2, "0");
  const seconds = String(fecha.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const intervalId = setInterval(checkFileModification, checkInterval);

module.exports = { iniciar, verUltimoCambio, parar };

if (verLog) {
  console.log(`${ID_MOD} - Directorio trabajo:`, process.cwd());
  console.log(`${ID_MOD} - Directorio del archivo:`, __dirname);
}
