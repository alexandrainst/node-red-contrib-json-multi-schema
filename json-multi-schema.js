/* globals RED */
/* jshint esversion:8, node:true, strict:true */

module.exports = RED => {
	"use strict";

	function JsonMultiSchemaNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		const cachePath = process.env.CACHE_PATH || '/tmp/';	//TODO: use better location for cache
		node.debug('Cache path: ' + cachePath);

		const crypto = require('crypto');
		const fetch = require('node-fetch');
		const fs = require('fs');
		const util = require('util');
		const readFileAsync = util.promisify(fs.readFile);
		const writeFileAsync = util.promisify(fs.writeFile);

		async function loadSchemaAsync(url) {
			let schema, hash;
			if (cachePath) {
				hash = cachePath + crypto.createHash('sha256').update(url).digest('hex') + '.json';
				try {
					const data = await readFileAsync(hash, 'utf8');
					node.debug('Load schema from cache: ' + url);
					schema = JSON.parse(data);
				} catch (ex) {
					schema = false;
				}
			}
			if (!schema) {
				node.log('Load schema from Web: ' + url);
				const res = await fetch(url);
				schema = await res.json();
				if (cachePath) {
					try {
						await writeFileAsync(hash, JSON.stringify(schema), 'utf8');
					} catch (ex) {
						node.warn('Error saving cache of "%s" in "%s"', url, cachePath);
					}
				}
			}
			return schema;
		}

		const Ajv = require('ajv');
		const ajv = Ajv({
			allErrors: true,	//TODO: Make a parameter
			loadSchema: loadSchemaAsync,
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

	RED.nodes.registerType('json-multi-schema', JsonMultiSchemaNode);
};
