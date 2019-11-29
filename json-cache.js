/* jshint esversion:8, node:true, strict:true */

const cachePath = process.env.CACHE_PATH || '/tmp/';	//TODO: use better location for cache

const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

module.exports = node => {
	"use strict";
	node.debug('Cache path: ' + cachePath);

	async function loadAsync(url, parse = true) {
		let data, json, hash;
		if (cachePath) {
			hash = cachePath + crypto.createHash('sha256').update(url).digest('hex') + '.json';
			try {
				data = await readFileAsync(hash, 'utf8');
				node.debug('Load JSON from cache: ' + url);
				if (parse) {
					json = JSON.parse(data);
				}
			} catch (ex) {
				data = false;
				json = false;
			}
		}
		if (!data) {
			node.log('Load JSON from Web: ' + url);
			const res = await fetch(url);
			if (parse) {
				json = await res.json();
			} else {
				data = await res.text();
			}
			if (cachePath) {
				try {
					await writeFileAsync(hash, parse ? JSON.stringify(json) : data, 'utf8');
				} catch (ex) {
					node.warn('Error saving cache of "%s" in "%s"', url, cachePath);
				}
			}
		}
		return parse ? json : data;
	}

	return {
		loadAsync: loadAsync,
	};
};
