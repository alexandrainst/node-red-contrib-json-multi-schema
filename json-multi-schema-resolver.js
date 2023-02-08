/**
 * Node-RED node that can determine the URL of the JSON Schema to use for a given JSON payload received,
 * using a list of possible JSON Schemas (mappings), which is automatically downloaded and cached the first time it is needed.
 */

const jsonata = require('jsonata');
const util = require('util');

module.exports = RED => {
	'use strict';

	function JsonMultiSchemaResolverNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		const mappingsUrl = config.mappingsUrl;

		let lastStatusError = true;
		node.status({ fill: 'grey', shape: 'ring', text: 'Uninitialized' });

		const jsonCache = require('./json-cache.js')(node);

		/**
		 * Find the URL to the JSON Schema or JSONata expression to use for the given payload.
		 */
		async function resolveAsync(payload) {
			const mappings = await jsonCache.loadAsync(mappingsUrl);
			let schemaUrl = '';
			for (const mapping of mappings) {
				if (mapping.query && mapping.cases) {
					const expression = jsonata(mapping.query);
					let match = await expression.evaluate(payload);
					if (match) {
						if (match === true) {
							// Special case for boolean
							match = 'true';
						}
						const result = mapping.cases[match];
						if (result) {
							schemaUrl = result;
							break;
						}
					}
				}
			}
			return schemaUrl;
		}

		node.on('input', async msg => {
			delete msg.schemaUrl;
			try {
				const schemaUrl = await resolveAsync(msg.payload);
				if (schemaUrl != '') {
					msg.schemaUrl = schemaUrl;
					msg.error = msg.error ? msg.error : false;
				}
				if (lastStatusError) {
					node.status({ fill: 'green', shape: 'dot', text: 'OK' });
					lastStatusError = false;
				}
			} catch (ex) {
				lastStatusError = true;
				node.status({ fill: 'red', shape: 'ring', text: 'Error' });
				msg.error = msg.error ? msg.error + ' ; ' : '';
				msg.error += util.format('Error resolving schema using "%s": %s', mappingsUrl, ex);
			}
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-resolver', JsonMultiSchemaResolverNode);
};
