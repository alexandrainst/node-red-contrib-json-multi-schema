/* jshint esversion:8, node:true, strict:true */
/**
 * Node-RED node transforming a JSON observation from whichever format to another format using a specified JSONata URL.
 * Schemas are automatically downloaded and cached the first time they are needed.
 * JSONata expressions are cached in memory.
 */

const jsonata = require('jsonata');
const util = require('util');

module.exports = RED => {
	"use strict";

	function JsonMultiSchemaTransformerNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		const transformsUrl = config.transformsUrl;

		let lastStatusError = true;
		node.status({ fill:'grey', shape:'ring', text:'Uninitialized', });

		const jsonCache = require('./json-cache.js')(node);

		/**
		 * Find the URL to the JSONata expression to use for the given payload.
		 */
		async function resolveAsync(payload) {
			const transforms = await jsonCache.loadAsync(transformsUrl);
			let transformUrl = '';
			for (const mapping of transforms) {
				if (mapping.query && mapping.cases) {
					const expression = jsonata(mapping.query);
					let match = expression.evaluate(payload);
					if (match) {
						if (match === true) {
							//Special case for boolean
							match = "true";
						}
						const result = mapping.cases[match];
						if (result) {
							transformUrl = result;
							break;
						}
					}
				}
			}
			return transformUrl;
		}

		//Cache of JSONata expressions
		const jsonatas = {};

		/**
		 * Transform the given payload with the JSONata expression given in URL.
		 */
		async function transformAsync(payload, transformUrl) {
			if (transformUrl) {
				let jsonataExpression;
				let jsonataCache = jsonatas[transformUrl];
				if (jsonataCache) {
					if (jsonataCache.expression === null) {
						//Wait for another task to be done building the same JSONata, so that we can use its cache
						await new Promise((resolve, reject) => jsonataCache.mutexQueue.push(resolve));
					}
					jsonataExpression = jsonataCache.expression;
				} else {
					//Build JSONata expression for the given transformation URL
					jsonataCache = { expression: null, mutexQueue: [] };
					jsonatas[transformUrl] = jsonataCache;
					const transform = await jsonCache.loadAsync(transformUrl, false);
					node.debug('Build JSONata expression for: ' + transformUrl);
					jsonataExpression = jsonata(transform);
					jsonataCache.expression = jsonataExpression;

					//Resume tasks waiting for the same JSONata expression
					let next;
					while ((next = jsonataCache.mutexQueue.shift()) != undefined) {
						next();	//Resolve promise
					}
				}

				if (jsonataExpression) {
					//Perform transformation
					return jsonataExpression.evaluate(payload);
				}
			}
			return false;
		}

		node.on('input', async msg => {
			delete msg.transformUrl;
			msg.error = msg.error ? msg.error + ' ; ' : '';
			try {
				const transformUrl = await resolveAsync(msg.payload);
				if (transformUrl != '') {
					msg.transformUrl = transformUrl;
					const result = await transformAsync(msg.payload, msg.transformUrl);
					if (result) {
						msg.payload = result;
						msg.error = msg.error != '';
					} else {
						lastStatusError = true;
						node.status({ fill:'red', shape:'ring', text:'Error', });
						msg.error += util.format('Failed tranforming using "%s"', transformsUrl);
					}
					if (lastStatusError) {
						node.status({ fill:'green', shape:'dot', text:'OK', });
						lastStatusError = false;
					}
				}
			} catch (ex) {
				lastStatusError = true;
				node.status({ fill:'red', shape:'ring', text:'Error', });
				msg.error += util.format('Error tranforming using "%s": %s : %s', transformsUrl, ex, JSON.stringify(msg.payload));
			}
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-transformer', JsonMultiSchemaTransformerNode);
};
