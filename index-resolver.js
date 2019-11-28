/* jshint esversion:8, node:true, strict:true */
"use strict";
/**
 * Command-line interface for the json-multi-schema-resolver Node-RED module.
 * 
 * Script to run our Node-RED module from terminal without Node-RED and using STDIN / STDOUT.
 *
 * @author Alexandre Alapetite <https://alexandra.dk/alexandre.alapetite>
 * @copyright Alexandra Institute <https://alexandra.dk> for the SynchroniCity European project <https://synchronicity-iot.eu> as a contribution to FIWARE <https://www.fiware.org>
 * @license AGPL
 * @version 2019-11-28
 */

const args = process.argv.slice(2);
console.error(JSON.stringify(args));

//Load fake/mocked Node-RED
const RED = require('./RED-mock.js');

//Load our Node-RED module
const noderedModule = require('./json-multi-schema-resolver.js');
noderedModule(RED);

//Number of STDIN lines for which we have not received a result yet
let nbAwaited = 0;
let done = false;

//When our Node-RED module sends/outpus a new message
RED.node.on('send', msg => {
	console.log(msg);
	nbAwaited--;
	if (done && nbAwaited <= 0) {
		process.exit(0);
	}
});

RED.node.on('error', msg => {
	console.error(msg);
});

RED.node.on('log', msg => {
	console.warn(msg);
});


const readline = require('readline');

const rl = readline.createInterface({
	input: process.stdin,
	terminal: false,
});

//Read JSON messages from standard input
rl.on('line', line => {
	try {
		const msg = JSON.parse(line);
		nbAwaited++;
		RED.node.input(msg);
	} catch (ex) {
		console.error('Invalid JSON input: ' + ex);
	}
});

rl.on('error', () => {
	console.error('==== STDIN error ====');
	done = true;
});

rl.on('pause', () => {
	console.error('==== STDIN paused ====');
	done = true;
});

rl.on('close', () => {
	console.error('==== STDIN closed ====');
	done = true;
});

console.error('==== STDIN started ====');
