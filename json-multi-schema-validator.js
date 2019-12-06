/* jshint esversion:8, node:true, strict:true */
/**
 * Node-RED node that can validate a JSON payload against a specified JSON Schema URL.
 * JSON Schemas are automatically downloaded and cached the first time they are needed.
 */

const util = require('util');

module.exports = RED => {
	"use strict";

	function JsonMultiSchemaNodeValidator(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		const jsonCache = require('./json-cache.js')(node);

		//Ajv: Another JSON Schema Validator
		const Ajv = require('ajv');
		const ajv = Ajv({
			allErrors: true,	//TODO: Make a parameter
			loadSchema: jsonCache.loadAsync,
			messages: true,	//TODO: Make a parameter
		});

		//Cache of validators for different schemas
		const validators = {};

		async function validateAsync(schemaUrl, payload) {
			if (!schemaUrl) {
				return 'Error: Invalid schema URL';
			}

			let validatorCache = validators[schemaUrl];
			if (validatorCache) {
				if (validatorCache.validator === null) {
					//Wait for another task to be done building the validator for the same desired schema, so that we can use its cache
					await new Promise((resolve, reject) => validatorCache.mutexQueue.push(resolve));
				}
				//Perform validation
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
				//Prepare validator for the desired schema
				validatorCache = { validator: null, mutexQueue: [] };
				validators[schemaUrl] = validatorCache;
				let task;

				try {
					node.debug('Compile Ajv for: ' + schemaUrl);
					const validator = await ajv.compileAsync({"$ref":schemaUrl});
					if (validator) {
						validatorCache.validator = validator;
						task = validateAsync(schemaUrl, payload);
					} else {
						validatorCache.validator = false;
						node.error('Unknown error compiling schema: ' + schemaUrl);
					}
				} catch (ex) {
					validatorCache.validator = false;
					node.error('Error compiling schema: ' + schemaUrl + ' : ' + ex);
				}
				//TODO: Set node status

				//Resume tasks waiting for the same validator
				let next;
				while ((next = validatorCache.mutexQueue.shift()) != undefined) {
					next();	//Resolve promise
				}

				return task ? await task : false;
			}
		}

		node.on('input', async msg => {
			delete msg.error;
			try {
				const result = await validateAsync(msg.schemaUrl, msg.payload);
				if (result === true) {
					msg.error = false;
				} else {
					msg.payload = null;
					msg.error = util.format('Failed validatation against "%s": %s', msg.schemaUrl, result);
				}
			} catch (ex) {
				msg.payload = null;
				msg.error = util.format('Failed validatation against "%s": %s', msg.schemaUrl, ex);
			}
			node.send(msg);
		});
	}

	RED.nodes.registerType('json-multi-schema-validator', JsonMultiSchemaNodeValidator);
};
