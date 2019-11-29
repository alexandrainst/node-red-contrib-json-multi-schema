# node-red-contrib-json-schema
Set of generic JSON data pipeline tools, suitable from continuous/streaming input, and with dynamic configuration.

All the modules are made for [Node-RED](https://nodered.org) but can alternatively be run from command-line using standard input/output.
Matching rules and transformation rules are written in [JSONata](http://jsonata.org) (JSON query and transformation language).

Appropriate e.g. for working with [FIWARE](https://www.fiware.org/developers/data-models/)’s [Smart Data Models](https://smart-data-models.github.io/data-models/).

Made in November 2019 by [Alexandre Alapetite](https://alexandra.dk/alexandre.alapetite) at the Alexandra Institute <https://alexandra.dk> for the SynchroniCity European project <https://synchronicity-iot.eu> as a contribution to FIWARE <https://www.fiware.org>.

*TODO*: License

*TODO*: Node-RED screenshot


<br /><br />
---


## node-red-contrib-json-multi-transformer
* *Context*: Node-RED node, or command line with [`index-transformer.js`](./index-transformer.js)
* *Purpose*: Ability to transform a JSON observation on the fly from whichever format to another format  (e.g. one of the FIWARE NGSI types) using a specified JSONata Schema URL. Schemas are automatically downloaded and cached the first time they are needed.
* *Configuration*: A Node-RED `transformUrl` property to indicate the URL of a file listing which JSONata file to use for which data input. (See example below).
* *Input*: A JSON observation in whichever format in the `msg.payload` property.
* *Output*: The transformed JSON observation in the `msg.payload` property.

### Example of input data

This is an example of non-standard payload, which needs to be transformed into a standard format.

We represent the example as a full Node-RED message, i.e. wrapped into a `{"payload":...}` structure.

```json
{
	"payload": {
		"id": "vehicle:WasteManagement:1",
		"type": "BasicVehicle",
		"vehicleType": "lorry",
		"category1": "municipalServices",
		"latitude": -3.164485591715449,
		"longitude": 40.62785133667262,
		"name": "C Recogida 1",
		"speed": 50,
		"cargoWeight": 314,
		"serviceStatus": "onRoute",
		"serviceProvided1": "garbageCollection",
		"serviceProvided2": "wasteContainerCleaning",
		"areaServed": "Centro",
		"refVehicleModel": "vehiclemodel:econic",
		"vehiclePlateIdentifier": "3456ABC"
	}
}
```

### Example of configuration file listing the transformations

In the example, this JSON file is hosted at `https://synchronicity.example.net/smart-data-transforms.json`

`query` is a [JSONata expression](http://docs.jsonata.org/simple). In this example, it will match the input data above.

```json
[
	{
		"query": "type='BasicVehicle' and latitude",
		"cases": {
			"true": "https://synchronicity.example.net/OldVehicleToVehicle.jsonata.js"
		}
	},
	{
		"query": "type='WeatherObserved' and latitude and longitude",
		"cases": {
			"true": "https://synchronicity.example.net/OldWeatherObservedToVehicle.jsonata.js"
		}
	}
]
```

### Example of JSONata transformation

In the example, this JSONata file is hosted at `https://synchronicity.example.net/OldVehicleToVehicle.jsonata.js`

```js
{
	"id": id,
	"type": "Vehicle",
	"vehicleType": vehicleType,
	"category": [
		category1
	],
	"location": {
		"type": "Point",
		"coordinates": [
			longitude,
			latitude
		]
	},
	"name": name,
	"speed": speed,
	"cargoWeight": cargoWeight,
	"serviceStatus": serviceStatus,
	"serviceProvided": [
		serviceProvided1,
		serviceProvided2
	],
	"areaServed": areaServed,
	"refVehicleModel": refVehicleModel,
	"vehiclePlateIdentifier": vehiclePlateIdentifier
}
```

### Example of transformation from command line
The JSON input messages must each be on one single line, and wrapped into a Node-RED structure `{"payload":...}`

```sh
echo '{"payload":{"id":"vehicle:WasteManagement:1","type":"BasicVehicle","vehicleType":"lorry","category1":"municipalServices","latitude":-3.164485591715449,"longitude":40.62785133667262,"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided1":"garbageCollection","serviceProvided2":"wasteContainerCleaning","areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"}}' | node ./index-transformer.js 'https://synchronicity.example.net/smart-data-transforms.json'
```

Output:

```json
{"payload":{"id":"vehicle:WasteManagement:1","type":"Vehicle","vehicleType":"lorry","category":["municipalServices"],"location":{"type":"Point","coordinates":[40.62785133667262,-3.164485591715449]},"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided":["garbageCollection","wasteContainerCleaning"],"areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"},"transformUrl":"https://synchronicity.example.net/OldVehicleToVehicle.jsonata.js"}
```


<br /><br />
---


## node-red-contrib-json-multi-schema-resolver
* *Context*: Node-RED node, or command line with [`index-resolver.js`](./index-resolver.js)
* *Purpose*: Ability to determine the URL of the JSON Schema (e.g. FIWARE NGSI) or JSONata schema to use for a given JSON payload received.
* *Input*: A JSON observation (e.g. one of the FIWARE NGSI types) in the `msg.payload` property.
* *Output*: The unmodified JSON observation in the `msg.payload` property, and the resolved schema URL in the `msg.schemaUrl` property.

### Example of input data
This is an example of [standard payload](https://fiware-datamodels.readthedocs.io/en/latest/Transportation/Vehicle/Vehicle/doc/spec/index.html),
for which we need to look-up the [corresponding JSON Schema](https://smart-data-models.github.io/data-models/specs/Transportation/Vehicle/VehicleModel/schema.json).

We represent the example as a full Node-RED message, i.e. wrapped into a `{"payload":...}` structure.

```json
{
	"payload": {
		"id": "vehicle:WasteManagement:1",
		"type": "Vehicle",
		"vehicleType": "lorry",
		"category": ["municipalServices"],
		"location": {
			"type": "Point",
			"coordinates": [40.62785133667262, -3.164485591715449]
		},
		"name": "C Recogida 1",
		"speed": 50,
		"cargoWeight": 314,
		"serviceStatus": "onRoute",
		"serviceProvided": ["garbageCollection", "wasteContainerCleaning"],
		"areaServed": "Centro",
		"refVehicleModel": "vehiclemodel:econic",
		"vehiclePlateIdentifier": "3456ABC"
	}
}
```

### Example of configuration file listing the JSON schemas

In the example, this JSON file is hosted at `https://synchronicity.example.net/smart-data-models.json`

`query` is a [JSONata expression](http://docs.jsonata.org/simple). In this example, it will match the input data above on `"type":"Vehicle"`

```json
[
	{
		"query": "type",
		"cases": {
			"AeroAllergenObserved": "https://smart-data-models.github.io/data-models/specs/Environment/AeroAllergenObserved/schema.json",
			...
			"Vehicle": "https://smart-data-models.github.io/data-models/specs/Transportation/Vehicle/Vehicle/schema.json",
			"WasteContainer": "https://smart-data-models.github.io/data-models/specs/WasteManagement/WasteContainer/schema.json",
		}
	}
]
```

### Example of schema resolution from command line
The JSON input messages must each be on one single line, and wrapped into a Node-RED structure `{"payload":...}`

```sh
echo '{"payload":{"id":"vehicle:WasteManagement:1","type":"Vehicle","vehicleType":"lorry","category":["municipalServices"],"location":{"type":"Point","coordinates":[40.62785133667262,-3.164485591715449]},"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided":["garbageCollection","wasteContainerCleaning"],"areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"}' | node ./index-resolver.js 'https://synchronicity.example.net/smart-data-models.json'
```

Output:

```json
{"payload":{"id":"vehicle:WasteManagement:1","type":"Vehicle","vehicleType":"lorry","category":["municipalServices"],"location":{"type":"Point","coordinates":[40.62785133667262,-3.164485591715449]},"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided":["garbageCollection","wasteContainerCleaning"],"areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"},"schemaUrl":"https://smart-data-models.github.io/data-models/specs/Transportation/Vehicle/Vehicle/schema.json"}
```


<br /><br />
---


## node-red-contrib-json-multi-schema-validator
* *Context*: Node-RED node, or command line with [`index-validator.js`](./index-validator.js)
* *Purpose*: Ability to validate a JSON observation (e.g. one of the FIWARE NGSI types) on the fly against a specified JSON Schema URL. Schemas are automatically downloaded and cached the first time they are needed.
* *Input*: A JSON observation (e.g. one of the FIWARE NGSI types) in the `msg.payload` property, and the corresponding JSON Schema URL on the `msg.schemaUrl` property.
* *Output*: The unmodified JSON observation in the `msg.payload` property, and potential validation errors in the `msg.error` property.
* *Implementation*: Based on [AJV](https://ajv.js.org).

### Example of input data
This is an example of [standard payload](https://fiware-datamodels.readthedocs.io/en/latest/Transportation/Vehicle/Vehicle/doc/spec/index.html),
which we want to validate against its [corresponding JSON Schema](https://smart-data-models.github.io/data-models/specs/Transportation/Vehicle/VehicleModel/schema.json),
which address is provided by the Node-RED property `msg.schemaUrl`.

```json
{
	"payload": {
		"id": "vehicle:WasteManagement:1",
		"type": "Vehicle",
		"vehicleType": "lorry",
		"category": ["municipalServices"],
		"location": {
			"type": "Point",
			"coordinates": [40.62785133667262, -3.164485591715449]
		},
		"name": "C Recogida 1",
		"speed": 50,
		"cargoWeight": 314,
		"serviceStatus": "onRoute",
		"serviceProvided": ["garbageCollection", "wasteContainerCleaning"],
		"areaServed": "Centro",
		"refVehicleModel": "vehiclemodel:econic",
		"vehiclePlateIdentifier": "3456ABC"
	},
	"schemaUrl": "https://smart-data-models.github.io/data-models/specs/Transportation/Vehicle/Vehicle/schema.json"
}
```

### Example of JSON Schema validation from command line
The JSON input messages must each be on one single line, and wrapped into a Node-RED structure `{"payload":...}`

```sh
echo '{"payload":{"id":"vehicle:WasteManagement:1","type":"Vehicle","vehicleType":"lorry","category":["municipalServices"],"location":{"type":"Point","coordinates":[40.62785133667262,-3.164485591715449]},"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided":["garbageCollection","wasteContainerCleaning"],"areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"}' | node ./index-resolver.js 'https://synchronicity.example.net/smart-data-models.json'
```

Output:

```json
{"payload":{"id":"vehicle:WasteManagement:1","type":"Vehicle","vehicleType":"lorry","category":["municipalServices"],"location":{"type":"Point","coordinates":[40.62785133667262,-3.164485591715449]},"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided":["garbageCollection","wasteContainerCleaning"],"areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"},"schemaUrl":"https://smart-data-models.github.io/data-models/specs/Transportation/Vehicle/Vehicle/schema.json","error":false}
```


<br /><br />
---


## Wiring/Piping all modules together
The three modules above may be used independently or in combination.
Here is an example of JSON transformation, followed by a schema resolver, and finally a JSON Schema validation.

### Wiring in Node-RED
Cf. screenshot at the top of this document.

### Piping on command line
```sh
echo '{"payload":{"id":"vehicle:WasteManagement:1","type":"BasicVehicle","vehicleType":"lorry","category1":"municipalServices","latitude":-3.164485591715449,"longitude":40.62785133667262,"name":"C Recogida 1","speed":50,"cargoWeight":314,"serviceStatus":"onRoute","serviceProvided1":"garbageCollection","serviceProvided2":"wasteContainerCleaning","areaServed":"Centro","refVehicleModel":"vehiclemodel:econic","vehiclePlateIdentifier":"3456ABC"}}' | \
node ./index-transformer.js 'https://synchronicity.example.net/smart-data-transforms.json' | node ./index-resolver.js 'https://synchronicity.example.net/smart-data-models.json' | node ./index-validate.js
```

_Note_: This is the example used for `npm test`


<br /><br />
---


## Docker
*TODO*
