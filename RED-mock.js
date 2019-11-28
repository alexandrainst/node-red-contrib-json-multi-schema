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
	};

module.exports = RED;
