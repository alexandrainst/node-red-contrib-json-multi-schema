/* jshint esversion:8, node:true, strict:true */

const jsonata = require('jsonata');
const util = require('util');

module.exports = RED => {
	"use strict";

	function JsonMultiSchemaResolverNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		const mappingsUrl = config.mappingsUrl;
		let mappings = [];

		const jsonCache = require('./json-cache.js')(node);

		async function resolveAsync(payload) {
			if (!mappings || mappings.length <= 0) {
				mappings = await jsonCache.loadAsync(mappingsUrl);
			}
			if (!mappings || mappings.length <= 0) {
				node.warn('Error loading the mappings from : ' + mappingsUrl);
				return false;
			}
			let schemaUrl = '';
			for (let mapping of mappings) {
				if (mapping.query && mapping.cases) {
					const expression = jsonata(mapping.query);
					let match = expression.evaluate(payload);
					if (match) {
						if (match === true) {
							match = "true";
						}
						const result = mapping.cases[match];
						//TODO: Consider allowing a regex for matches
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
			delete msg.error;
			try {
				const schemaUrl = await resolveAsync(msg.payload);
				if (schemaUrl != '') {
					msg.schemaUrl = schemaUrl;
				} else {
					msg.payload = null;
					msg.error = util.format('Failed resolving schema using "%s"', mappingsUrl);
				}
			} catch (ex) {
				msg.payload = null;
				msg.error = util.format('Error resolving schema using "%s": %s', mappingsUrl, ex);
			}
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-resolver', JsonMultiSchemaResolverNode);
};
