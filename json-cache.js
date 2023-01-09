/**
 * Module to asynchronously download JSON (and text such as JSONata) documents, then cache them in memory and on disk.
 * Handles concurrency (when multiple tasks are asking the same document at the same time).
 */

// Location of disk copy of retrieved JSON documents
const cachePath = process.env.SCHEMAS_CACHE_PATH || '/tmp/';	// TODO: use better location for cache

const crypto = require('crypto');
const fetch = require('node-fetch');
const fs = require('fs');
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

// Memory copy of retrieved JSON documents
const ramCaches = {};

// Queue of concurrent tasks waiting for the same JSON documents
const mutexQueue = {};

module.exports = node => {
	'use strict';
	node.debug('Disk cache path: ' + cachePath);

	/**
	 * Returns memory copy of desired JSON document if it exists, false otherwise.
	 */
	function ramCache(url, parse) {
		const ramCache = ramCaches[url];
		if (ramCache) {
			if (parse) {
				if (ramCache.json) {
					return ramCache.json;
				}
			} else {
				if (ramCache.text) {
					return ramCache.text;
				}
			}
		}
		return false;
	}

	async function loadAsync(url, parse = true) {
		let result = ramCache(url, parse);
		if (result) {
			return result;
		}

		if (mutexQueue[url]) {
			// Wait for another task to be done loading the same URL, so that we can use its cache
			await new Promise((resolve, reject) => mutexQueue[url].push(resolve));

			result = ramCache(url, parse);
			if (result) {
				return result;
			}
		} else {
			mutexQueue[url] = [];
			ramCaches[url] = {};
		}

		let text, json, hash;
		if (cachePath) {
			hash = cachePath + 'schema.' + crypto.createHash('sha256').update(url).digest('hex') + '.' + node.id + '.tmp.js';
			try {
				text = await readFileAsync(hash, 'utf8');
				node.debug('Load JSON from disk cache: ' + url);
				if (parse) {
					json = JSON.parse(text);
					ramCaches[url].json = json;
				} else {
					ramCaches[url].text = text;
				}
			} catch (ex) {
				text = false;
				json = false;
			}
		}
		if (!text) {
			node.log('Load JSON from Web: ' + url);
			const res = await fetch(url);
			if (parse) {
				json = await res.json();
				ramCaches[url].json = json;
			} else {
				text = await res.text();
				ramCaches[url].text = text;
			}
			if (cachePath) {
				try {
					await writeFileAsync(hash, parse ? JSON.stringify(json) : text, 'utf8');
				} catch (ex) {
					node.warn('Error saving disk cache of "%s" in "%s"', url, cachePath);
				}
			}
		}

		// Resume tasks waiting for the same URL
		let next;
		while ((next = mutexQueue[url].shift()) != undefined) {
			next();	// Resolve promise
		}
		delete mutexQueue[url];

		return parse ? json : text;
	}

	return {
		loadAsync,
	};
};
