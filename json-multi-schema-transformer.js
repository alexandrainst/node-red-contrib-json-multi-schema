/* jshint esversion:8, node:true, strict:true */

const jsonata = require('jsonata');
const util = require('util');

module.exports = RED => {
	"use strict";

	function JsonMultiSchemaTransformerNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;
		const transformsUrl = config.transformsUrl;
		let transforms = [];

		const jsonCache = require('./json-cache.js')(node);

		async function resolveAsync(payload) {
			if (!transforms || transforms.length <= 0) {
				transforms = await jsonCache.loadAsync(transformsUrl);
			}
			if (!transforms || transforms.length <= 0) {
				node.warn('Error loading the transforms from : ' + transformsUrl);
				return false;
			}
			let transformUrl = '';
			for (let mapping of transforms) {
				if (mapping.query && mapping.cases) {
					const expression = jsonata(mapping.query);
					let match = expression.evaluate(payload);
					if (match) {
						if (match === true) {
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

		async function transformAsync(payload, transformUrl) {
			if (transformUrl) {
				const transform = await jsonCache.loadAsync(transformUrl, false);
				const expression = jsonata(transform);
				return expression.evaluate(payload);
			}
			return false;
		}

		node.on('input', async msg => {
			delete msg.transformUrl;
			delete msg.error;
			try {
				const transformUrl = await resolveAsync(msg.payload);
				if (transformUrl != '') {
					msg.transformUrl = transformUrl;
					const result = await transformAsync(msg.payload, msg.transformUrl);
					if (result) {
						msg.payload = result;
					} else {
						msg.payload = null;
						msg.error = util.format('Failed tranforming using "%s"', transformsUrl);
					}
				} else {
					msg.payload = null;
					msg.error = util.format('Failed resolving tranforms using "%s"', transformsUrl);
				}
			} catch (ex) {
				msg.payload = null;
				msg.error = util.format('Error tranforming using "%s": %s', transformsUrl, ex);
			}
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-transformer', JsonMultiSchemaTransformerNode);
};
