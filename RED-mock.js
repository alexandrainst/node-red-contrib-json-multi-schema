/* jshint esversion:8, node:true, strict:true */
"use strict";
/**
 * Node-RED mocker.
 * 
 * This script mocks Node-RED so that it is possible
 * to natively call a module originally designed for Node-RED from command line without requiring Node-RED.
 *
 * @author Alexandre Alapetite <https://alexandra.dk/alexandre.alapetite>
 * @copyright Alexandra Institute <https://alexandra.dk> for the SynchroniCity European project <https://synchronicity-iot.eu> as a contribution to FIWARE <https://www.fiware.org>
 * @license AGPL
 * @version 2019-11-28
 */

const EventEmitter = require('events').EventEmitter;

const RED = {
		node: null,
		nodes: {
			list: [],
			createNode: (node, config) => {
				node.eventEmitter = new EventEmitter();
				node.on = (eventName, listener) => node.eventEmitter.on(eventName, listener);
				node.debug = msg => {
					node.eventEmitter.emit('debug', msg);
					if (node.eventEmitter.listenerCount('debug') <= 0) {
						console.warn(msg);
					}
				};
				node.error = msg => {
					node.eventEmitter.emit('error', msg);
					if (node.eventEmitter.listenerCount('error') <= 0) {
						console.warn(msg);
					}
				};
				node.input = msg => node.eventEmitter.emit('input', msg);
				node.log = msg => {
					node.eventEmitter.emit('log', msg);
					if (node.eventEmitter.listenerCount('log') <= 0) {
						console.warn(msg);
					}
				};
				node.send = msg => node.eventEmitter.emit('send', msg);
				RED.node = node;
				RED.nodes.list.push(node);
			},
			config: {},
			registerType: (name, f) => new f(RED.nodes.config),
		},
		run: () => {
			//Number of STDIN lines for which we have not received a result yet
			let nbAwaited = 0;
			let done = false;

			//When our Node-RED module sends/outpus a new message
			RED.node.on('send', msg => {
				console.log(JSON.stringify(msg));
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
		},
	};

module.exports = RED;
