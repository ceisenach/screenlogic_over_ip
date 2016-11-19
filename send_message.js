const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const net = require('net');
const BROADCAST_ADDRESS = '255.255.255.255';
const PENTAIR_PORT = 1444; //see line 189

var LOCATED_SYSTEM = null; // will hold the system locator response
const DEBUG_FLAG = false;

var EXTRACT_STRING_TYPE = 1; //used to handle potential UTF16 encodings


///////////////////////////////////////////////////
//////////////// RESPONSE HEADERS /////////////////
///////////////////////////////////////////////////
const Pool_Controller_Configuration_Response_Code = 12533;


//////////////////////////////////////////////////
//////////// BYTE HELPER FUNCTIONS ///////////////
//////////////////////////////////////////////////
//gets 32bit word from byte array
function get_word32_as_little_endian(byte_array,offset) {
    var result = 0;
    if (byte_array.length >= offset + 4) {
        result = (((0 + (byte_array[offset + 3] & 0xFF) << 8) + (byte_array[offset + 2] & 0xFF) << 8) + (byte_array[offset + 1] & 0xFF) << 8) + (byte_array[offset + 0] & 0xFF);
    }
    return result;
};

//gets 16bit word from array of bytes
function get_word16_as_little_endian(byte_array,offset) {
    var result = 0;
    if (byte_array.length >= offset + 4) {
        result = (((byte_array[offset + 1] & 0xFF) + 0) << 8) + (byte_array[offset + 0] & 0xFF);
    }
    return result;
};

//get the low byte of a 32bit word
function get_word32_byte3(num) {
    return (num & 0xFF);
}

//get second lowest byte of 32bit word
function get_word32_byte2(num) {
    return (num >> 8) & 0xFF;
}

//get second highest byte of 32bit word
function get_word32_byte1(num) {
    return (num >> 16) & 0xFF;
}

//get highest byte of 32bit word
function get_word32_byte0(num) {
    return (num >> 24) & 0xFF;
}

function get_string_from_byte_array(byte_array,offset) {
    var s = "";
    if((byte_array[offset+3] & 0x80) != 0) {
        console.log('TYPE 2 STRING');
        EXTRACT_STRING_TYPE = 2; //This means it is UTF16 -- might not work
        byte_array[offset+3] = byte_array[offset+3] + 128;
        var string_length = get_word32_as_little_endian(byte_array,offset);
        var idx = offset + 4;
        while(byte_array[idx] != 0 && idx < idx+string_length) {
            s = s+String.fromCharCode(get_word16_as_little_endian(byte_array,idx));
            idx = idx + 2;
        }
        return s;
    } else{
        EXTRACT_STRING_TYPE = 1; //UTF8 -- this is good and works. Always seems to be this encoding
        var string_length = get_word32_as_little_endian(byte_array,offset);
        var idx = offset + 4;
        while(idx < (offset+4+string_length)) {
            s = s + String.fromCharCode(byte_array[idx]);
            idx = idx + 1;
        }
        return s;
    }
}

//////////////////////////////////////////////////
////////////// MESSAGE BUILDERS //////////////////
//////////////////////////////////////////////////
function push_string_to_buffer(buf,s) {
    var string_length = s.length;
    var current_buffer_length = buf.length;
    var padding = 4 - (string_length % 4);

    //allocate new buffer
    var new_buffer = Buffer.alloc(current_buffer_length+string_length+padding+4);

    //copy old buffer
    for(i=0;i < current_buffer_length; i++){
        new_buffer[i] = buf[i];
    }

    //write string length in little endian
    new_buffer[current_buffer_length] = get_word32_byte3(string_length);
    new_buffer[current_buffer_length+1] = get_word32_byte2(string_length);
    new_buffer[current_buffer_length+2] = get_word32_byte1(string_length);
    new_buffer[current_buffer_length+3] = get_word32_byte0(string_length);

    //copy string
    for(i=0; i < string_length; i++){
        new_buffer[current_buffer_length+4+i] = s.charCodeAt(i);
    }
    return new_buffer;
}
function push_word32_to_buffer(buf,num) {
    var current_buffer_length = buf.length;
    var new_buffer = Buffer.alloc(current_buffer_length+4);
    //copy old buffer
    for(i=0;i < current_buffer_length; i++){
        new_buffer[i] = buf[i];
    }

    new_buffer[current_buffer_length] = get_word32_byte3(num);
    new_buffer[current_buffer_length+1] = get_word32_byte2(num);
    new_buffer[current_buffer_length+2] = get_word32_byte1(num);
    new_buffer[current_buffer_length+3] = get_word32_byte0(num);

    return new_buffer;
}
function push_word16_to_buffer(buf,num) {
    var current_buffer_length = buf.length;
    var new_buffer = Buffer.alloc(current_buffer_length+2);
    //copy old buffer
    for(i=0;i < current_buffer_length; i++){
        new_buffer[i] = buf[i];
    }

    new_buffer[current_buffer_length] = get_word32_byte3(num);
    new_buffer[current_buffer_length+1] = get_word32_byte2(num);

    return new_buffer;
}
function push_byte_to_buffer(buf,num) {
    var current_buffer_length = buf.length;
    var new_buffer = Buffer.alloc(current_buffer_length+1);
    //copy old buffer
    for(i=0;i < current_buffer_length; i++){
        new_buffer[i] = buf[i];
    }
    new_buffer[current_buffer_length] = num;

    return new_buffer;
}
function push_buffer_to_buffer(buf,buf2) {
    var buf_length = buf.length;
    var buf_2_length = buf2.length;

    //allocate new buffer
    var new_buffer = Buffer.alloc(buf_length+buf_2_length+4);

    //copy buf
    for(i=0;i < buf_length; i++){
        new_buffer[i] = buf[i];
    }
    //write buffer length in little endian
    new_buffer[buf_length] = get_word32_byte3(buf_2_length);
    new_buffer[buf_length+1] = get_word32_byte2(buf_2_length);
    new_buffer[buf_length+2] = get_word32_byte1(buf_2_length);
    new_buffer[buf_length+3] = get_word32_byte0(buf_2_length);
    //copy buf2
    for(i=0;i < buf_2_length; i++){
        new_buffer[buf_length+i+4] = buf2[i];
    }

    return new_buffer;
}


function decorate_pentair_message(hdr,msg) {
    var data_size = 0;
    if(msg != null){
        data_size = msg.length;
    }

    // all headers are 4 bytes, even if header array longer, only take first 4 bits
    const dpm = Buffer.alloc(8 + data_size);
    for (i=0; i < 4; i++) {
        dpm[i] = hdr[i];
    }
    dpm[4] = get_word32_byte3(data_size);
    dpm[5] = get_word32_byte2(data_size);
    dpm[6] = get_word32_byte1(data_size);
    dpm[7] = get_word32_byte0(data_size);
    if(data_size > 0){
            for(i= 0; i < data_size; i++){
            dpm[i+8] = msg[i];
        }
    }
    
    if(DEBUG_FLAG) {
        console.log('Decorated Message - ');
        console.log(dpm);
    }
    return dpm;
}

//////////////////////////////////////////////////
//////////// SYSTEM LOCATOR RESPONSE /////////////
//////////////////////////////////////////////////
// See UDPResponse:new()
function SystemLocatorUDPResponse(msg) {
    this.check_byte = get_word32_as_little_endian(msg,0);
    this.pentair_ip_raw = msg.slice(4,8);
    this.pentair_ip = this.pentair_ip_raw[0]+'.'+this.pentair_ip_raw[1]+'.'+this.pentair_ip_raw[2]+'.'+this.pentair_ip_raw[3];
    this.pentair_comm_port = get_word16_as_little_endian(msg,8);
    this.pentair_gateway_type = msg[10];
    this.pentair_gateway_subtype = msg[11];
    this.is_valid_response = function () { return check_byte == 2 };

    // Parse Name -- Starts at offset 12
    var cur_char = 12;
    var max_length = 28;
    var pgn = "";
    while(msg[cur_char] != 0 && cur_char < msg.length) {
        pgn += String.fromCharCode(msg[cur_char]);
        ++cur_char;
    }
    this.pentair_gateway_name = pgn;
}

///////////////////////////////////////////////////////////////
////////////////////// CONNECT AND LOGIN //////////////////////
///////////////////////////////////////////////////////////////
function create_incoming_connection_message() {
    const connect_string = 'CONNECTSERVERHOST';
    const scm = Buffer.alloc(connect_string.length + 4);
    for(i=0; i < connect_string.length; i++) {
        scm[i] = connect_string.charCodeAt(i);
    }
    scm[connect_string.length +0] = 13;
    scm[connect_string.length +1] = 10;
    scm[connect_string.length +2] = 13;
    scm[connect_string.length +3] = 10;
    if(DEBUG_FLAG) {
        console.log('INITIAL CONNECT MESSAGE - ');
        console.log(scm);
    }

    return scm;
}

function create_login_message_data(schema,con_type,vers,data_array,procID) {
    //1 - add schema to buffer
    var data_buffer = Buffer.alloc(4);
    data_buffer[0] = get_word32_byte3(schema);
    data_buffer[1] = get_word32_byte2(schema);
    data_buffer[2] = get_word32_byte1(schema);
    data_buffer[3] = get_word32_byte0(schema);
    //2 - add connection type
    data_buffer = push_word32_to_buffer(data_buffer,con_type);
    //3 - add version
    data_buffer = push_string_to_buffer(data_buffer,vers);
    //4 - add data_array
    data_buffer = push_buffer_to_buffer(data_buffer,data_array);
    //5 - add proc ID
    data_buffer = push_word32_to_buffer(data_buffer,procID);
    if(DEBUG_FLAG) {
        console.log('LOGIN MESSAGE DATA - ');
        console.log(data_buffer);
    }
    return data_buffer;
}

function pentair_connect_and_login() {

    // Soft Connect
    console.log('STEP 1 - Soft Connecting');
    const scm = create_incoming_connection_message();

    // Log In
    console.log('STEP 2 - LOG IN');
    var empty_data = Buffer.alloc(16);
    var login_data = create_login_message_data(348,0,'Android',empty_data,2);
    var login_headers = Buffer.alloc(4);

    login_headers[0] = get_word32_byte3(0);
    login_headers[1] = get_word32_byte2(0);
    login_headers[2] = get_word32_byte3(27);
    login_headers[3] = get_word32_byte2(27);

    var login_msg = decorate_pentair_message(login_headers,login_data);
    var control_config_query_msg = Pool_Controller_Configuration_Query();
    var heatmode_set_msg = Pool_Set_Heat_Mode(0,1,3);
    var spahigh_set_msg = Pool_Set_Buttonpress(0,503,1);
    var lights_set_msg = Pool_Colorlights_Command(0,17);

    const net = require('net');
    const client = net.connect({host: LOCATED_SYSTEM.pentair_ip, port: LOCATED_SYSTEM.pentair_comm_port}, () => {
        // 'connect' listener
        console.log('Connected to Pentair Server!');
        client.write(scm);
        

        /// Example of sending messages
        setTimeout(() => {client.write(login_msg);},100);
        setTimeout(() => {client.write(control_config_query_msg);},200);
        setTimeout(() => {client.write(lights_set_msg);},300);
        setTimeout(() => {client.write(spahigh_set_msg);},400);
        setTimeout(() => {client.write(heatmode_set_msg);},400);
    });
    client.on('data', (data) => {
      console.log('RECEIVING TCP RESPONSE -- ')
      console.log(data);
      process_pentair_response(data);
    });
    client.on('end', () => {
      console.log('Disconnected from server!');
    });
            
}

/////////////////////////////////////////////////////////////
///////////////////// PROCESS PENTAIR RESPONSE //////////////
/////////////////////////////////////////////////////////////
function process_pentair_response(data){
    hdr1 = get_word16_as_little_endian(data,0);
    hdr2 = get_word16_as_little_endian(data,2);

    if(hdr1 == 0 && hdr2 == Pool_Controller_Configuration_Response_Code) {
        Pool_Controller_Configuration_Response(data);
    }
}

function Pool_Controller_Configuration_Response(data) {
    const data_offset = 8;
    console.log('-------------------------------------------');
    console.log('--- RECEIVED POOL CONTROLLER CONFIGURATION');
    console.log('-------------------------------------------');
    console.log('\tController ID: '+get_word32_as_little_endian(data,data_offset + 0));
    console.log('\tMin Set Point: '+data[data_offset + 4]);
    console.log('\tMax Set Point: '+data[data_offset + 5]);
    console.log('\tMin Set Point: '+data[data_offset + 6]);
    console.log('\tMin Set Point: '+data[data_offset + 7]);
    console.log('\tDeg C: '+data[data_offset + 8]);
    console.log('\tController Type: '+data[data_offset + 9]);
    console.log('\tHW Type: '+data[data_offset + 10]);
    console.log('\tController Data: '+data[data_offset + 11]);
    console.log('\tEquip Flags: '+data[data_offset + 12]);
    
    var gencircname = get_string_from_byte_array(data,data_offset + 16);
    var cn_padding = EXTRACT_STRING_TYPE*gencircname.length % 4;
    if(cn_padding != 0){
        cn_padding = 4-cn_padding;
    }

    console.log('\tGeneric Circuit Name: '+gencircname);
    var cur_idx = data_offset + 16 + 4 + cn_padding + EXTRACT_STRING_TYPE*gencircname.length;
    var circuit_count = get_word32_as_little_endian(data,cur_idx)
    console.log('\tCircuit Count: '+ circuit_count);
    cur_idx = cur_idx + 4;
    var i = 0;
    while(i < circuit_count) {
        console.log('\tNEXT CIRCUIT -- ')
        var circ_id = get_word32_as_little_endian(data,cur_idx);
        console.log('\t\tCircuit ID: '+circ_id);
        cur_idx = cur_idx+4;
        console.log('\t\tCircuit Name IDX: '+cur_idx)
        var circuit_name = get_string_from_byte_array(data,cur_idx)
        var cn_padding = EXTRACT_STRING_TYPE*circuit_name.length % 4;
        if(cn_padding != 0){
            cn_padding = 4-cn_padding;
        }
        cur_idx = cur_idx + 4 + cn_padding + EXTRACT_STRING_TYPE*circuit_name.length;
        console.log('\t\tCircuit Name: '+circuit_name);
        cur_idx = cur_idx + 12;
        i ++;
    }
}

//////////////////////////////////////////////////////////
////////////////// MESSAGE BUILDERS //////////////////////
//////////////////////////////////////////////////////////

function Pool_Controller_Configuration_Query() {
    var hdr = Buffer.alloc(4);
    hdr[0] = 0;
    hdr[1] = 0;
    hdr[2] = get_word32_byte3(12532);
    hdr[3] = get_word32_byte2(12532);
    if (DEBUG_FLAG){
        console.log(hdr);
    }
    // Data for query is to INT 0s - 8 bytes
    var data = Buffer.alloc(8);
    var msg = decorate_pentair_message(hdr,data);
    return msg;
}

function System_Configuration_Get_Version_Query() {
    // codes: 0, 8120
    var hdr = Buffer.alloc(4);
    hdr[0] = 0;
    hdr[1] = 0;
    hdr[3] = get_word32_byte3(8120);
    hdr[4] = get_word32_byte2(8120);
    var data = null;
    var msg = decorate_pentair_message(hdr,data);
    return msg;
}

function Set_Server_Get_Default_Scheme_Query() {
    // codes: 0, 8120
    var hdr = Buffer.alloc(4);
    hdr[0] = get_word32_byte3(924); // ID 924?
    hdr[1] = get_word32_byte2(924);
    hdr[2] = get_word32_byte3(8120);
    hdr[3] = get_word32_byte2(8120);
    var data = Buffer.alloc(2);
    var msg = decorate_pentair_message(hdr,data);
    return msg;
}

function Pool_Set_Heat_Set_Point(ControllerIndex,BodyType,NewTemp) {
    // codes: 0,12538
    var hdr = Buffer.alloc(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(12538);
    hdr[3] = get_word32_byte2(12538);
    //1 - add controller index
    var data_buffer = Buffer.alloc(4);
    data_buffer[0] = get_word32_byte3(ControllerIndex);
    data_buffer[1] = get_word32_byte2(ControllerIndex);
    data_buffer[2] = get_word32_byte1(ControllerIndex);
    data_buffer[3] = get_word32_byte0(ControllerIndex);
    //2 - add bodytype
    data_buffer = push_word32_to_buffer(data_buffer,BodyType);
    //3 - add new temp setting
    data_buffer = push_word32_to_buffer(data_buffer,NewTemp);

    var msg = decorate_pentair_message(hdr,data_buffer);
    return msg;
}

function Pool_Set_Heat_Mode(ControllerIndex,BodyType,Mode) {
    // codes: 0,12538
    var hdr = Buffer.alloc(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(12538);
    hdr[3] = get_word32_byte2(12538);
    //1 - add controller index
    var data_buffer = Buffer.alloc(4);
    data_buffer[0] = get_word32_byte3(ControllerIndex);
    data_buffer[1] = get_word32_byte2(ControllerIndex);
    data_buffer[2] = get_word32_byte1(ControllerIndex);
    data_buffer[3] = get_word32_byte0(ControllerIndex);
    //2 - add bodytype
    data_buffer = push_word32_to_buffer(data_buffer,BodyType);
    //3 - add heater mode
    data_buffer = push_word32_to_buffer(data_buffer,Mode);

    var msg = decorate_pentair_message(hdr,data_buffer);
    return msg;
}

function Pool_Set_Buttonpress(ControllerIndex,CircuitID,OnOff) {
    // code 0,12530
    var hdr = Buffer.alloc(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(12530);
    hdr[3] = get_word32_byte2(12530);
    //1 - add controller index
    var data_buffer = Buffer.alloc(4);
    data_buffer[0] = get_word32_byte3(ControllerIndex);
    data_buffer[1] = get_word32_byte2(ControllerIndex);
    data_buffer[2] = get_word32_byte1(ControllerIndex);
    data_buffer[3] = get_word32_byte0(ControllerIndex);
    //2 - add circuit ID
    data_buffer = push_word32_to_buffer(data_buffer,CircuitID);
    //3 - add OnOff
    data_buffer = push_word32_to_buffer(data_buffer,OnOff);

    var msg = decorate_pentair_message(hdr,data_buffer);
    return msg;
}

function Pool_Colorlights_Command(ControllerIndex,cmd) {
    var hdr = Buffer.alloc(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(12556);
    hdr[3] = get_word32_byte2(12556);
    //1 - add controller index
    var data_buffer = Buffer.alloc(4);
    data_buffer[0] = get_word32_byte3(ControllerIndex);
    data_buffer[1] = get_word32_byte2(ControllerIndex);
    data_buffer[2] = get_word32_byte1(ControllerIndex);
    data_buffer[3] = get_word32_byte0(ControllerIndex);
    //2 - add command
    data_buffer = push_word32_to_buffer(data_buffer,cmd);

    var msg = decorate_pentair_message(hdr,data_buffer);
    return msg;
}

/////////////////////////////////////////////////////////////////////////
////////////// BROADCAST PING MESSAGE TO LOCATE SERVER //////////////////
/////////////////////////////////////////////////////////////////////////
server.on('error', (err) => {
  console.log(`server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  console.log(`RAW RESPONSE: **`+msg.toString('hex')+ `** from ${rinfo.address}:${rinfo.port}`);
  var check_byte = get_word32_as_little_endian(msg,0);
  console.log('Check Byte (should be 2): '+check_byte);
  var pentair_ip = msg.slice(4,8);
  console.log('Decoded IP Address: '+pentair_ip[0]+'.'+pentair_ip[1]+'.'+pentair_ip[2]+'.'+pentair_ip[3]);
  var pentair_comm_port = get_word16_as_little_endian(msg,8);
  console.log(msg[8]);
  console.log(msg[9]);
  console.log('Decoded Port: '+pentair_comm_port);
  var pentair_gateway_type = msg[10];
  var pentair_gateway_subtype = msg[11];
  LOCATED_SYSTEM = new SystemLocatorUDPResponse(msg);
  console.log(LOCATED_SYSTEM);
  server.close();
});

server.on('listening', () => {
  var address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

const PING_MESSAGE = Buffer.alloc(8); //see line 170
PING_MESSAGE[0] = 1;
server.bind( function() { server.setBroadcast(true) } ); //see line 156
server.send(PING_MESSAGE,0,8,PENTAIR_PORT,BROADCAST_ADDRESS);

// SEND INITIAL CONNECTION MESSAGE
setTimeout(pentair_connect_and_login,500);