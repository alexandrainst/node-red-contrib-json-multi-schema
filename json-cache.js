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

	async function loadAsync(url) {
		let json, hash;
		if (cachePath) {
			hash = cachePath + crypto.createHash('sha256').update(url).digest('hex') + '.json';
			try {
				const data = await readFileAsync(hash, 'utf8');
				node.debug('Load JSON from cache: ' + url);
				json = JSON.parse(data);
			} catch (ex) {
				json = false;
			}
		}
		if (!json) {
			node.log('Load JSON from Web: ' + url);
			const res = await fetch(url);
			json = await res.json();
			if (cachePath) {
				try {
					await writeFileAsync(hash, JSON.stringify(json), 'utf8');
				} catch (ex) {
					node.warn('Error saving cache of "%s" in "%s"', url, cachePath);
				}
			}
		}
		return json;
	}

	return {
		loadAsync: loadAsync,
	};
};
