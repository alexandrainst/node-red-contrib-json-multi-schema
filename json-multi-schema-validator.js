/* jshint esversion:8, node:true, strict:true */

const util = require('util');

module.exports = RED => {
	"use strict";

	function JsonMultiSchemaNodeValidator(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		const jsonCache = require('./json-cache.js')(node);

		const Ajv = require('ajv');
		const ajv = Ajv({
			allErrors: true,	//TODO: Make a parameter
			loadSchema: jsonCache.loadAsync,
			messages: true,	//TODO: Make a parameter
		});

		const validators = {};

		async function validateAsync(schemaUrl, payload) {
			if (!schemaUrl) {
				return 'Error: Invalid schema URL';
			}
			let validator = validators[schemaUrl];
			if (validator) {
				if (validator(payload)) {
					return true;
				} else {
					return 'Errors: ' + JSON.stringify(validator.errors);
				}
			} else {
				try {
					validator = await ajv.compileAsync({"$ref":schemaUrl});
					if (validator) {
						validators[schemaUrl] = validator;
						return await validateAsync(schemaUrl, payload);
					} else {
						node.error('Unknown error compiling schema: ' + schemaUrl);
					}
				} catch (ex) {
					node.error('Error compiling schema: ' + schemaUrl + ' : ' + ex);
				}
				return false;
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
