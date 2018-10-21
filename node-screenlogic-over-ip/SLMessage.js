var du = require('./data_utils');
var extend = require('./inheritance').extend

const MESSAGE_TYPES = {
	'LoginQuery' : 27,
	'LoginResponse' : 28,
	'StatusQuery' : 12526,
	'StatusResponse' : 12527,
	'SetButtonPressQuery' : 12530,
	'SetButtonPressResponse' : 12531,
	'ControllerConfigQuery' : 12532,
	'ControllerConfigResponse' : 12533,
	'SetHeatModeQuery' : 12538
};


//////////////////////////////////////////////
// Response Message Parsing
//////////////////////////////////////////////
function ParseResponsePacket(response_string){
	var response_array = new du.ArrayBuffer();
	response_array.fillFromString(response_string);
	var id = response_array.readUInt16LE();
	var message_type = response_array.readUInt16LE();
	var content_length = response_array.readUInt32LE();
	var response;
	switch(message_type) {
		case MESSAGE_TYPES.LoginResponse:
			console.log('Login Success!!');
			break;
		case MESSAGE_TYPES.SetButtonPressResponse:
			console.log('Button Pressed!!');
			break;
		case MESSAGE_TYPES.StatusResponse:
			console.log('Got Some Status!!');
			response = new StatusResponse(response_array);
			break;
		case MESSAGE_TYPES.ControllerConfigResponse:
			console.log('Got Controller Config!!');
			response = new ControllerConfigResponse(response_array);
			break;
		default:
			console.log('Message Not recognized :(');
	}
	console.log(response);
	return response;
}


///////////////////////////////////////////////
// Message Base
//////////////////////////////////////////////
function MessageBase(id,message_type){
	this.message_content = new du.ArrayBuffer();
	this.message_header = new du.ArrayBuffer();
	this.message_header.writeUInt16LE(id);
	this.message_header.writeUInt16LE(message_type);
};

MessageBase.prototype.fillString = function() {
	this.message_header.writeUInt32LE(this.message_content.length())
	return this.message_header.fillString() + this.message_content.fillString();
};



///////////////////////////////////////////////
// Login Message and Response
//////////////////////////////////////////////
function LoginQuery() {
	MessageBase.call(this,0,MESSAGE_TYPES.LoginQuery);
	this.message_type = 'Login Message';

	// default constructor params
	const schema = 348;
	const connection_type = 0;
	const version = 'Android';
	const data_array = new du.ArrayBuffer(16);
	const procID = 2;

	// build message content
	//1 - add schema to buffer
	this.message_content.writeUInt32LE(schema);
	//2 - add connection type
	this.message_content.writeUInt32LE(connection_type);
	//3 - add version
	this.message_content.writeString(version);
	//4 - add data_array
	this.message_content.writeBuffer(data_array)
	//5 - add proc ID
	this.message_content.writeUInt32LE(procID);
};
extend(MessageBase,LoginQuery)




///////////////////////////////////////////////
// Get Status Query and Response
//////////////////////////////////////////////
function StatusQuery() {
	MessageBase.call(this,0,MESSAGE_TYPES.StatusQuery);
	this.message_type = 'Status Query Message';

	// build message content
	// always has a single  32-bit 0
	this.message_content.writeUInt32LE(0);
};
extend(MessageBase,StatusQuery)

function StatusResponse(message_content) {
	// Decode status
	this.ok = message_content.readUInt32LE();
	this.freeze_mode = message_content.readUInt8LE();
	this.remotes = message_content.readUInt8LE();
	this.pool_delay = message_content.readUInt8LE();
	this.spa_delay = message_content.readUInt8LE();
	this.cleaner_delay = message_content.readUInt8LE();
	message_content.readUInt8LE(); //remove padding
	message_content.readUInt8LE(); //remove padding
	message_content.readUInt8LE(); //remove padding
	this.air_temp = message_content.readUInt32LE();
	this.body_count = message_content.readUInt32LE();
	if(this.body_count > 2) {
		this.body_count = 2;
	}

	//parse bodies
	this.bodies = Array();
	for(var i=0; i < this.body_count; i++){
		// get idx of this body
		var idx = message_content.readUInt32LE();
		if(idx < 0 || idx > 1) {
			idx = 0;
		}
		var next_body = {
			'current_temp' : message_content.readUInt32LE(),
			'heat_status' : message_content.readUInt32LE(),
			'set_point' : message_content.readUInt32LE(),
			'cool_set_point' : message_content.readUInt32LE(),
			'heat_mode' : message_content.readUInt32LE(),
		};
		this.bodies[idx] = next_body;
	}

	//parse circuits
	this.circuit_count = message_content.readUInt32LE();
	this.circuits = Array();
	for(var i=0; i < this.circuit_count; i++) {
		var next_circuit = {
			'id' : message_content.readUInt32LE(),
			'state' : message_content.readUInt32LE(),
			'color_set' : message_content.readUInt8LE(),
			'color_pos' : message_content.readUInt8LE(),
			'color_stagger' : message_content.readUInt8LE(),
			'delay' : message_content.readUInt8LE()
		};
		this.circuits[i] = next_circuit;
	}
	this.PH = message_content.readUInt32LE();
	this.ORP = message_content.readUInt32LE();
	this.saturation = message_content.readUInt32LE();
	this.salt_ppm = message_content.readUInt32LE();
	this.PH_tank = message_content.readUInt32LE();
	this.ORP_tank = message_content.readUInt32LE();
	this.alarms = message_content.readUInt32LE();
}


///////////////////////////////////////////////
// Get Config Query and Response
//////////////////////////////////////////////
function ControllerConfigQuery() {
	MessageBase.call(this,0,MESSAGE_TYPES.ControllerConfigQuery);
	this.message_type = 'Controller Configuration Query Message';

	// build message content
	// always has two 0 parameters
	this.message_content.writeUInt32LE(0);
	this.message_content.writeUInt32LE(0);
};
extend(MessageBase,ControllerConfigQuery)

function ControllerConfigResponse(message_content) {
	// Decode Configuration
	this.controller_id = message_content.readUInt32LE();
	this.min_set_points = Array();
	this.max_set_points = Array();
	this.min_set_points[0] = message_content.readUInt8LE();
	this.max_set_points[0] = message_content.readUInt8LE();
	this.min_set_points[1] = message_content.readUInt8LE();
	this.max_set_points[1] = message_content.readUInt8LE();
	this.deg_c = message_content.readUInt8LE();
	this.controller_type = message_content.readUInt8LE();
	this.hw_type = message_content.readUInt8LE();
	this.controller_data = message_content.readUInt8LE();
	this.equip_flags = message_content.readUInt32LE();
	this.generic_circuit_name = message_content.readString();
	this.circuit_count = message_content.readUInt32LE();
	this.circuits = Array();
	for(var i=0; i < this.circuit_count; i++) {
		var new_circuit = {
			'id' : message_content.readUInt32LE(),
			'name' : message_content.readString(),
			'name_index': message_content.readUInt8LE(),
			'function' : message_content.readUInt8LE(),
			'interface' : message_content.readUInt8LE(),
			'flags' : message_content.readUInt8LE(),
			'color_set' : message_content.readUInt8LE(),
			'color_pos' : message_content.readUInt8LE(),
			'color_stagger' : message_content.readUInt8LE(),
			'device_id' : message_content.readUInt8LE(),
			'default_RT' : message_content.readUInt16LE(),
			'pad_1' : message_content.readUInt8LE(),
			'pad_2' : message_content.readUInt8LE()
		};
		this.circuits[i] = new_circuit;
	}
}







///////////////////////////////////////////////
// Initiate Connection
//////////////////////////////////////////////
function IncomingConnectionPacket() {
	this.message = new du.ArrayBuffer();
	this.message.writeStringRaw('CONNECTSERVERHOST');
    this.message.push(13);
    this.message.push(10);
    this.message.push(13);
    this.message.push(10);
    this.fillString = function() {return this.message.fillString();}
};



// Queries
module.exports.LoginQuery = LoginQuery;
module.exports.StatusQuery = StatusQuery;
module.exports.ControllerConfigQuery = ControllerConfigQuery;

// Other
module.exports.IncomingConnectionPacket = IncomingConnectionPacket;
module.exports.MESSAGE_TYPES = MESSAGE_TYPES;
module.exports.ParseResponsePacket = ParseResponsePacket;