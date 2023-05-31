/**
 * Node-RED node that validates a JSON payload against a specified JSON Schema URL.
 * JSON Schemas are automatically downloaded and cached on disk the first time they are needed.
 * JSON Schema validators are cached in memory.
 */

// Ajv: Another JSON Schema Validator
const addFormats = require('ajv-formats').default;
const util = require('util');

module.exports = RED => {
	'use strict';

	function JsonMultiSchemaNodeValidator(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		let lastStatusError = true;
		node.status({ fill: 'grey', shape: 'ring', text: 'Uninitialized' });

		const jsonCache = require('./json-cache.js')(node);

		let ajv;
		const opts = {
			allErrors: true,	// TODO: Make a parameter
			loadSchema: jsonCache.loadAsync,
			messages: true,	// TODO: Make a parameter
		};

		// http://json-schema.org/specification.html
		// https://ajv.js.org/json-schema.html#json-schema-versions
		switch (config.schemaVersion) {
			case 'draft-2020-12': {
				const Ajv2020 = require('ajv/dist/2020');
				ajv = new Ajv2020(opts);
				break;
			}
			case 'draft-2019-09': {
				const Ajv2019 = require('ajv/dist/2019');
				ajv = new Ajv2019(opts);
				const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json');
				ajv.addMetaSchema(draft7MetaSchema);
				break;
			}
			case 'draft-06': {
				const Ajv = require('ajv');
				const draft6MetaSchema = require('ajv/dist/refs/json-schema-draft-06.json');
				ajv = new Ajv(opts);
				ajv.addMetaSchema(draft6MetaSchema);
				break;
			}
			case 'draft-04': {
				const Ajv = require('ajv-draft-04');
				ajv = new Ajv(opts);
				break;
			}
			case 'draft-07':
			default: {
				const Ajv = require('ajv');
				ajv = new Ajv(opts);
				break;
			}
		}

		addFormats(ajv);

		// Cache of validators for different schemas
		const validators = {};

		/**
		 * Validate the given payload with the JSON Schema given in URL.
		 */
		async function validateAsync(payload, schemaUrl) {
			let validatorCache = validators[schemaUrl];
			if (validatorCache) {
				if (validatorCache.validator === null) {
					// Wait for another task to be done building the validator for the same desired schema,
					// so that we can use its cache
					await new Promise((resolve, reject) => validatorCache.mutexQueue.push(resolve));
				}
				// Perform validation
				const validator = validatorCache.validator;
				if (validator) {
					if (validator(payload)) {
						return true;
					} else {
						return 'Errors: ' + JSON.stringify(validator.errors);
					}
				} else {
					return 'Validator not found!';
				}
			} else {
				// Prepare validator for the desired schema
				validatorCache = { validator: null, mutexQueue: [] };
				validators[schemaUrl] = validatorCache;
				let task;

				try {
					node.debug('Compile Ajv for: ' + schemaUrl);
					const validator = await ajv.compileAsync({ $ref: schemaUrl });
					if (validator) {
						validatorCache.validator = validator;
						task = validateAsync(payload, schemaUrl);
					} else {
						validatorCache.validator = false;
						node.error('Unknown error compiling schema: ' + schemaUrl);
					}
				} catch (ex) {
					validatorCache.validator = false;
					lastStatusError = true;
					node.status({ fill: 'red', shape: 'ring', text: 'Error' });
					node.error('Error compiling schema: ' + schemaUrl + ' : ' + ex);
				}

				// Resume tasks waiting for the same validator
				let next;
				while ((next = validatorCache.mutexQueue.shift()) != undefined) {
					next();	// Resolve promise
				}

				return task ? await task : false;
			}
		}

		node.on('input', async msg => {
			msg.error = msg.error ? msg.error + ' ; ' : '';
			if (msg.schemaUrl) {
				msg.validUrl = msg.schemaUrl;
				try {
					const result = await validateAsync(msg.payload, msg.schemaUrl);
					if (result === true) {
						msg.error = msg.error != '';
					} else {
						msg.error += util.format('Failed validatation against "%s": %s', msg.schemaUrl, result);
					}
					if (lastStatusError) {
						node.status({ fill: 'green', shape: 'dot', text: 'OK' });
						lastStatusError = false;
					}
				} catch (ex) {
					lastStatusError = true;
					node.status({ fill: 'red', shape: 'ring', text: 'Error' });
					msg.error += util.format('Error validatating using "%s": %s', msg.schemaUrl, ex);
				}
			}
			delete msg.schemaUrl;
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-validator', JsonMultiSchemaNodeValidator);
};
