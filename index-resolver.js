/* jshint esversion:8, node:true, strict:true */
"use strict";
/**
 * Command-line interface for the json-multi-schema-resolver Node-RED module.
 * 
 * Script to run our Node-RED module from terminal without Node-RED and using STDIN / STDOUT.
 *
 * @author Alexandre Alapetite <https://alexandra.dk/alexandre.alapetite>
 * @copyright Alexandra Institute <https://alexandra.dk> for the SynchroniCity European project <https://synchronicity-iot.eu> as a contribution to FIWARE <https://www.fiware.org>
 * @license MIT
 * @version 2019-11-28
 */

const args = process.argv.slice(2);

//Load fake/mocked Node-RED
const RED = require('./RED-mock.js');
RED.nodes.config.mappingsUrl = args ? args[0] : '';
//TODO: Allow passing directy the mappings data

//Load our Node-RED module
const noderedModule = require('./json-multi-schema-resolver.js');
noderedModule(RED);

RED.run();
