//
//  Startup Code
//

System.Print("Pentair Driver: Initializing...\r\n");



/////////////////////////////////////////////////////////////
/////////////// CREATE MESSAGES /////////////////////////////
/////////////////////////////////////////////////////////////
function decorate_pentair_message(hdr,msg) {
    var data_size = 0;
    if(msg != null){
        data_size = msg.length;
    }

    // all headers are 4 bytes, even if header array longer, only take first 4 bits
    const dpm = new Array(8 + data_size);
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
    
    return dpm;
}


function create_incoming_connection_message() {
    const connect_string = 'CONNECTSERVERHOST';
    const scm = new Array(connect_string.length + 4);
    for(i=0; i < connect_string.length; i++) {
        scm[i] = connect_string.charCodeAt(i);
    }
    scm[connect_string.length +0] = 13;
    scm[connect_string.length +1] = 10;
    scm[connect_string.length +2] = 13;
    scm[connect_string.length +3] = 10;

    return scm;
}

function create_login_message_data(schema,con_type,vers,data_array,procID) {
    //1 - add schema to buffer
    var data_buffer = new Array(4);
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
    return data_buffer;
}

function Pool_Set_Buttonpress(ControllerIndex,CircuitID,OnOff) {
    // see codes- 0,12530
    var hdr = new Array(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(12530);
    hdr[3] = get_word32_byte2(12530);
    //1 - add controller index
    var data_buffer = new Array(4);
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

//////////////////////////////////////////////////////
//////////////// DATA STRUCTURES /////////////////////
//////////////////////////////////////////////////////
var MESSAGE_STACK_POINTERS = new_zeroed_array(50);
var MESSAGE_STACK = new_zeroed_array(1000);
var MESSAGE_STACK_TOP = 0;


function push_message(message) {
	next_blank = MESSAGE_STACK_POINTERS[MESSAGE_STACK_TOP];
	MESSAGE_STACK_TOP = MESSAGE_STACK_TOP + 1;
	MESSAGE_STACK_POINTERS[MESSAGE_STACK_TOP] = next_blank + message.length;
	for(i=0;i < message.length; i++) {
		MESSAGE_STACK[next_blank+i] = message[i];
	}
}

function pop_message() {
	if (MESSAGE_STACK_TOP > 0) {
		var cur_top = MESSAGE_STACK_TOP;
		var message_start = MESSAGE_STACK_POINTERS[cur_top - 1];
		var message_end = MESSAGE_STACK_POINTERS[cur_top];
		var message = MESSAGE_STACK.slice(message_start,message_end);
		MESSAGE_STACK_TOP = MESSAGE_STACK_TOP - 1;
		return message;
	}
	return null;
}

/////////////////////////////////////////////////////
/////////////////// SEND MESSAGES ///////////////////
/////////////////////////////////////////////////////
var g_comm = new TCP(OnCommRX);
g_comm.OnConnectFunc = OnTCPConnect;
g_comm.OnDisconnectFunc = OnTCPDisconnect;
g_comm.OnConnectFailedFunc = OnConnectFailed;

function OnCommRX(data){
	System.LogInfo(1,'PENTAIR DRIVER - Recieved: '+data+'\r\n');
}


function OnTCPConnect() {
	g_comm.SetTxInterMsgDelay(100);
	message = pop_message();
	while(message != null){
		System.LogInfo(1,'PENTAIR DRIVER - Sending Message\r\n');
		msg_string = pack_message_tostring(message);
		g_comm.Write(msg_string);
		message = pop_message();
	}
}

function OnTCPDisconnect() {
	System.LogInfo(1,"PENTAIR DRIVER - Disconnected From Pentair System\r\n");
	g_comm.Close();
}

function OnConnectFailed() {
	System.LogInfo(3,"PENTAIR DRIVER - Did Not Connect to Pentair System\r\n");
	g_comm.Close();
}

//
//  External Functions
//
function MSGControlCircuit(circ_id,state) {
	g_comm.Close();

    const scm = create_incoming_connection_message();
    var empty_data = new_zeroed_array(16);
    var login_data = create_login_message_data(348,0,'Android',empty_data,2);
    var login_headers = new_zeroed_array(4);

    login_headers[0] = get_word32_byte3(0);
    login_headers[1] = get_word32_byte2(0);
    login_headers[2] = get_word32_byte3(27);
    login_headers[3] = get_word32_byte2(27);

    var login_msg = decorate_pentair_message(login_headers,login_data);
    var circuit_set_msg = Pool_Set_Buttonpress(0,circ_id,state);

    push_message(circuit_set_msg);
    push_message(login_msg);
    push_message(scm);

	var openState = g_comm.Open(Config.Get('Pentair_IP'), 80);
}