/**
 * Node-RED node transforming a JSON observation from whichever format to another format using a specified JSONata URL.
 * Schemas are automatically downloaded and cached on disk the first time they are needed.
 * JSONata expressions are cached in memory.
 */

// JSONata: A declarative open-source query and transformation language for JSON data.
const jsonata = require('jsonata');
const util = require('util');

module.exports = RED => {
	'use strict';

	function JsonMultiSchemaTransformerNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		const defaultSchemaUrl = config.defaultSchemaUrl;

		let lastStatusError = true;
		node.status({ fill: 'grey', shape: 'ring', text: 'Uninitialized' });

		const jsonCache = require('./json-cache.js')(node);

		// Cache of JSONata expressions
		const jsonatas = {};

		/**
		 * Transform the given payload with the JSONata expression given in URL.
		 */
		async function transformAsync(payload, transformUrl) {
			let jsonataExpression;
			let jsonataCache = jsonatas[transformUrl];
			if (jsonataCache) {
				if (jsonataCache.expression === null) {
					// Wait for another task to be done building the same JSONata, so that we can use its cache
					await new Promise((resolve, reject) => jsonataCache.mutexQueue.push(resolve));
				}
				jsonataExpression = jsonataCache.expression;
			} else {
				// Build JSONata expression for the given transformation URL
				jsonataCache = { expression: null, mutexQueue: [] };
				jsonatas[transformUrl] = jsonataCache;
				const transform = await jsonCache.loadAsync(transformUrl, false);
				node.debug('Build JSONata expression for: ' + transformUrl);
				jsonataExpression = jsonata(transform);
				jsonataCache.expression = jsonataExpression;

				// Resume tasks waiting for the same JSONata expression
				let next;
				while ((next = jsonataCache.mutexQueue.shift()) != undefined) {
					next();	// Resolve promise
				}
			}

			if (jsonataExpression) {
				// Perform transformation
				return await jsonataExpression.evaluate(payload);
			}

			return false;
		}

		node.on('input', async msg => {
			msg.error = msg.error ? msg.error + ' ; ' : '';
			if (!msg.schemaUrl) {
				msg.schemaUrl = defaultSchemaUrl;
			}
			if (msg.schemaUrl) {
				msg.transformUrl = msg.schemaUrl;
				try {
					const result = await transformAsync(msg.payload, msg.schemaUrl);
					if (result) {
						msg.payload = result;
						msg.error = msg.error != '';
					} else {
						msg.error += util.format('Failed tranforming using "%s"', msg.schemaUrl);
					}
					if (lastStatusError) {
						node.status({ fill: 'green', shape: 'dot', text: 'OK' });
						lastStatusError = false;
					}
				} catch (ex) {
					lastStatusError = true;
					node.status({ fill: 'red', shape: 'ring', text: 'Error' });
					console.error('Schema2 ' + msg.schemaUrl);
					msg.error += util.format('Error tranforming using "%s": %s', msg.schemaUrl, ex);
				}
			}
			delete msg.schemaUrl;
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-transformer', JsonMultiSchemaTransformerNode);
};
