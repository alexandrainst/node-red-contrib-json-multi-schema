/**
 * JSONata for converting from NGSI Normalised format to Simplified representation with key-value pairs.
 *
 * Inspired by https://github.com/FIWARE/data-models/blob/master/tools/normalized2LD.py but reversed.
 *
 * @author Alexandre Alapetite <https://alexandra.dk/alexandre.alapetite>
 * @copyright Alexandra Institute <https://alexandra.dk> for the SynchroniCity European project <https://synchronicity-iot.eu> as a contribution to FIWARE <https://www.fiware.org>.
 * @license MIT
 * @date 2019-12-13 / 2019-12-17
 */
(
	$fixObj := function($v, $k) {
		/* Ensure ISO 8601 date format for minor syntax errors like missing timezone, or produce an error */
		$v.type = "DateTime" and $substring("" & $v.value, -1) != "Z" ? { $k: $fromMillis($toMillis($v.value)) } :
		{ $k: $v.value }
	};

	/* Transform to Simplified structure */
	$merge($each($, function($v, $k) {
		$exists($v.value) ? $fixObj($v, $k) :
		$exists($v.object) ? { $k: $v.object } :
		{ $k: $v }
	}))

	/* Replace (i.e. update, delete) some key names */
	~> | ** [createdAt] | {"dateCreated": createdAt}, ["createdAt"] |
	~> | ** [modifiedAt] | {"dateModified": modifiedAt}, ["modifiedAt"] |
)
