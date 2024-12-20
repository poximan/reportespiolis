const fs = require('fs');
const cheerio = require('cheerio');

const { logamarillo } = require('../control/controlLog');
const { sindet } = require('./etl');

const ID_MOD = 'TRANS';

function transpilar(reporte, estampatiempo, cb) {
	fs.readFile('./src/etl/plantilla.piolis', 'utf8', (err, data) => {
		if (err) {
			logamarillo(2, 'Error al leer el archivo:', err);
			res.status(500).send('Error interno del servidor');
			return;
		}

		let contenido = expandirPlantilla(reporte, data);
		contenido = sustituirMarcas(reporte, estampatiempo, contenido);
		contenido = calcularLlenadoMdy(reporte, contenido);
		contenido = calcularLlenadoTw(reporte, contenido);
		contenido = prepararGrafLineas(reporte, contenido);

		// solo para debug
		fs.writeFile('./src/etl/plantilla.expand.html', contenido, (err) => { logamarillo(1, err) });

		crearHTMLSalida(contenido, () => {
			cb();
		});
	});
}

/* ===========================================================
===================== FUNCIONES INTERNAS =====================
==============================================================
*/

function expandirPlantilla(reporte, data) {
	const $ = cheerio.load(data);

	// Seleccionar solo los <tr> dentro del <tbody>
	const tbody = $('tbody'); // Selecciona el <tbody>
	const filaPlantilla = tbody.find('tr').first();

	reporte.forEach((item, i) => {
		const fila = filaPlantilla.clone(); // Clonar la fila de la plantilla
		fila.find('td').eq(0).text(`SITIO_${i}`);
		fila.find('td').eq(1).text(`NIVEL_${i}`);
		fila.find('td').eq(2).text(`CLORO_${i}`);
		fila.find('td').eq(3).text(`TURB_${i}`);
		fila.find('td').eq(4).text(`VOLDIA_${i}`);
		tbody.append(fila); // Agregar la fila al <tbody>
	});

	filaPlantilla.remove();
	return $.html();
}

function sustituirMarcas(reporte, estampatiempo, contenido, cb) {
	contenido = contenido
		.replaceAll('<!-- ESTAMPATIEMPO -->', fechaLegible(estampatiempo))
		.replaceAll('<!-- HEADER_0 -->', reporte[0].variable.nivel.descriptor)
		.replaceAll('<!-- HEADER_1 -->', reporte[0].variable.cloro.descriptor)
		.replaceAll('<!-- HEADER_2 -->', reporte[0].variable.turbiedad.descriptor)
		.replaceAll('<!-- HEADER_3 -->', reporte[0].variable.voldia.descriptor);

	reporte.forEach((item, i) => {
		contenido = contenido
			.replace(`SITIO_${i}`, item.sitio)
			.replace(`NIVEL_${i}`, item.variable.nivel.valor === undefined ? '-' : item.variable.nivel.valor)
			.replace(`CLORO_${i}`, item.variable.cloro.valor === undefined ? '-' : item.variable.cloro.valor)

			.replace(`TURB_${i}`, item.variable.turbiedad.valor === undefined ? '-' : item.variable.turbiedad.valor)
			.replace(`VOLDIA_${i}`, item.variable.voldia.valor === undefined ? '-' : item.variable.voldia.valor);
	});

	contenido = contenido

		.replaceAll(
			'<!-- SITIOS -->',
			reporte.map((objeto) => "'" + objeto.sitio + "'")
		)
		.replaceAll(
			'<!-- NIVELES -->',
			reporte.map((objeto) => (objeto.variable.nivel.valor != sindet ? objeto.variable.nivel.valor : 0))
		)
		.replaceAll(
			'<!-- NIVELESTOTAL -->',
			parseFloat(
				reporte.reduce(
					(total, objeto) => total + (objeto.variable.nivel.valor != sindet ? objeto.variable.nivel.valor : 0),
					0
				)
			)
		)
		.replaceAll(
			'<!-- COMPLEMENTO -->',
			reporte.map((objeto) =>
				objeto.variable.nivel.valor != sindet
					? (objeto.variable.nivel.rebalse - objeto.variable.nivel.valor).toFixed(3)
					: 0
			)
		)
		.replaceAll(
			'<!-- COMPLEMENTOTOTAL -->',
			reporte
				.reduce(
					(total, objeto) =>
						total +
						(objeto.variable.nivel.valor != sindet
							? parseFloat((objeto.variable.nivel.rebalse - objeto.variable.nivel.valor).toFixed(3))
							: 0),
					0
				)
				.toFixed(3)
		)
		.replaceAll(
			'<!-- REBALSE -->',
			reporte.map((objeto) => objeto.variable.nivel.rebalse.toFixed(3))
		);

	return contenido;
}

function calcularLlenadoMdy(reporte, contenido) {
	const sindet = null; // Definir `sindet` si no está definido anteriormente

	// Filtrar solo los objetos donde `esMadryn` es `true`
	const reporteMadryn = reporte.filter(objeto => objeto.esMadryn);

	const sitios = reporteMadryn.map(objeto => `'${objeto.sitio}'`);
	const complemento = reporteMadryn.map(objeto =>
		objeto.variable.nivel.valor !== sindet ? objeto.variable.nivel.rebalse - objeto.variable.nivel.valor : 0
	);
	const niveles = reporteMadryn.map(objeto =>
		objeto.variable.nivel.valor !== sindet ? objeto.variable.nivel.valor : 0
	);
	const cubicaje = reporteMadryn.map(objeto =>
		objeto.variable.nivel.cubicaje !== sindet ? objeto.variable.nivel.cubicaje : 0
	);

	const { llenado, llenadoniveltotal, llenadocomplementototal } = niveles.reduce((acc, nivel, i) => {
		const resultado = nivel * cubicaje[i];
		acc.llenado.push(resultado);
		acc.llenadocomplementototal += complemento[i] * cubicaje[i];
		acc.llenadoniveltotal += resultado;
		return acc;
	}, { llenado: [], llenadoniveltotal: 0, llenadocomplementototal: 0 });

	const marcaPie = '[tracePieMdy]';
	const posicionMarcaPie = contenido.indexOf(marcaPie);

	// Modificar el contenido eliminando la marca y preparando el resultado final.
	let resultadoFinalPie = contenido.replace(marcaPie, '');
	const estructuraPie = `
        labels: ["VACIO", "TOTAL", "AGUA", ${sitios}],
        parents: ["TOTAL", "", "TOTAL", ${sitios.map(() => '"AGUA"').join(',')}],
        values: [${llenadocomplementototal}, ${llenadoniveltotal + llenadocomplementototal}, ${llenadoniveltotal}, ${llenado}],
    `;

	return resultadoFinalPie.slice(0, posicionMarcaPie) + estructuraPie + resultadoFinalPie.slice(posicionMarcaPie);
}

function calcularLlenadoTw(reporte, contenido) {
	const sindet = null; // Definir `sindet` si no está definido anteriormente

	// Filtrar solo los objetos donde `esMadryn` es `false`
	const reporteNoMadryn = reporte.filter(objeto => !objeto.esMadryn);

	const sitios = reporteNoMadryn.map(objeto => `'${objeto.sitio}'`);
	const complemento = reporteNoMadryn.map(objeto =>
		objeto.variable.nivel.valor !== sindet ? objeto.variable.nivel.rebalse - objeto.variable.nivel.valor : 0
	);
	const niveles = reporteNoMadryn.map(objeto =>
		objeto.variable.nivel.valor !== sindet ? objeto.variable.nivel.valor : 0
	);
	const cubicaje = reporteNoMadryn.map(objeto =>
		objeto.variable.nivel.cubicaje !== sindet ? objeto.variable.nivel.cubicaje : 0
	);

	const { llenado, llenadoniveltotal, llenadocomplementototal } = niveles.reduce((acc, nivel, i) => {
		const resultado = nivel * cubicaje[i];
		acc.llenado.push(resultado);
		acc.llenadocomplementototal += complemento[i] * cubicaje[i];
		acc.llenadoniveltotal += resultado;
		return acc;
	}, { llenado: [], llenadoniveltotal: 0, llenadocomplementototal: 0 });

	const marcaPie = '[tracePieTw]';
	const posicionMarcaPie = contenido.indexOf(marcaPie);

	// Modificar el contenido eliminando la marca y preparando el resultado final.
	let resultadoFinalPie = contenido.replace(marcaPie, '');
	const estructuraPie = `
        labels: ["TOTAL", "VACIO", "AGUA", ${sitios}],
        parents: ["", "TOTAL", "TOTAL", ${sitios.map(() => '"AGUA"').join(',')}],
        values: [${llenadocomplementototal}, ${llenadoniveltotal + llenadocomplementototal}, ${llenadoniveltotal}, ${llenado}],
    `;

	return resultadoFinalPie.slice(0, posicionMarcaPie) + estructuraPie + resultadoFinalPie.slice(posicionMarcaPie);
}

function prepararGrafLineas(reporte, contenido) {
	let traces = [];
	const marca = '[trace]';
	const posicionMarca = contenido.indexOf(marca) - 13;

	let primerafecha, ultimafecha, primerdia;

	// Elimina la marca del texto.
	let textoModificado = contenido.replace(marca, '');
	// Itera sobre el arreglo `reporte` e inserta la nueva estructura en la posición memorizada.
	let resultadoFinal = textoModificado.substring(0, posicionMarca); // Texto antes de la marca.

	for (let indice = 0; indice < reporte.length; indice++) {
		const historicos = reporte[indice].variable.nivel.historico;
		if (historicos == undefined) continue;

		const valx_millis = unpack(historicos, 'etiempo');
		const valx_iso = convertirTimestampsAISO(valx_millis);
		const valx = valx_iso.map((iso) => `"${iso}"`);

		if (indice == 0) {
			primerafecha = valx[valx.length - 24];
			ultimafecha = valx[valx.length - 1];
			primerdia = valx[0];
		}

		let valy = unpack(historicos, 'valor');

		traces[indice] = `trace${indice}`;

		let estructura = `
        \tvar ${traces[indice]} = {
        \t    name: "${reporte[indice].sitio}",
        \t    x: [${valx}],
        \t    y: [${valy}],
        \t    type: 'scatter',
			  line: {
				width: 1.5,
			  },
        \t};`;

		// Inserta la estructura en la posición original de la marca.
		resultadoFinal += estructura;
	}

	resultadoFinal += `\n\n\t\t\tvar datosLinea = [${traces.join(', ')}];`;

	resultadoFinal += `\n\t
  \t\t\tvar layout = {
  \t\t\t  title: 'Niveles Historicos',
  \t\t\t  height: 600,
  \t\t\t  font: {
  \t\t\t    family: 'consolas',
  \t\t\t    size: 12
  \t\t\t  },
  \t\t\t  xaxis: {
  \t\t\t    range: [${primerafecha}, ${ultimafecha}],
  \t\t\t    rangeselector: {buttons: [
  \t\t\t      {
  \t\t\t        count: 1,
  \t\t\t        label: 'dia',
  \t\t\t        step: 'day',
  \t\t\t        stepmode: 'backward'
  \t\t\t      },
  \t\t\t      {
  \t\t\t        count: 7,
  \t\t\t        label: 'semana',
  \t\t\t        step: 'day',
  \t\t\t        stepmode: 'backward'
  \t\t\t      },
  \t\t\t      {
  \t\t\t        count: 1,
  \t\t\t        label: 'mes',
  \t\t\t        step: 'month',
  \t\t\t        stepmode: 'backward'
  \t\t\t      },
  \t\t\t      {
  \t\t\t        label: 'desde el inicio de los tiempos',
  \t\t\t        step: 'all'
  \t\t\t      }
  \t\t\t    ]},
  \t\t\t    rangeslider: {range: [${primerdia}, ${ultimafecha}]},
  \t\t\t    type: 'date'
  \t\t\t  },
  \t\t\t  yaxis: {
  \t\t\t    title: 'Nivel',
  \t\t\t    range: [0, 5],  // Rango definido
  \t\t\t    type: 'linear'
  \t\t\t  }
  \t\t\t}`;
	// Agrega el contenido restante del texto original después de la marca.
	resultadoFinal += textoModificado.substring(posicionMarca + 1);

	return resultadoFinal;
}

function unpack(rows, key) {
	return rows.map(function (row) {
		return `${row[key]}`;
	});
}

function convertirTimestampsAISO(timestamps) {
	return timestamps.map((ts) => {
		const { date, time } = getCurrentDateTime(Number(ts));
		return `${date} ${time}`;
	});
}

function crearHTMLSalida(contenido, cb) {
	// Escribir en el archivo	
	fs.writeFile('./src/web/public/reporte.html', contenido, (err) => {
		if (err) {
			logamarillo(2, 'Error al escribir archivo:', err);
			return;
		}
		logamarillo(1, `${ID_MOD} - Archivo escrito correctamente`);
		cb();
	});
}

function fechaLegible(estampatiempo) {
	const { date, time } = getCurrentDateTime(estampatiempo);
	return `${date} ${time}`;
}

function getCurrentDateTime(estampatiempo) {
	const now = new Date(estampatiempo);
	const options = {
		year: '2-digit',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	};
	// es necesario compensar 3 horas por GMT-3 (tiempo medio de Greenwich)
	const formatter = new Intl.DateTimeFormat('es-ES', options);
	const parts = formatter.formatToParts(now);
	const date = `${parts[4].value}-${parts[2].value}-${parts[0].value}`; // dd/mm/yy
	const time = `${parts[6].value}:${parts[8].value}:${parts[10].value}`; // hh:mm:ss
	return { date, time };
}

// Exportar la función si es necesario
module.exports = {
	transpilar,
};
