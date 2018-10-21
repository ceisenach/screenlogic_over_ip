//
//  Startup Code
//

System.Print("Pentair Driver: Initializing...\r\n");

// communicator
var g_comm = new TCP(OnCommRX);
g_comm.OnConnectFunc = OnTCPConnect;
g_comm.OnDisconnectFunc = OnTCPDisconnect;
g_comm.OnConnectFailedFunc = OnConnectFailed;

// Timers
var reconnnect_timer = new Timer();
var ping_timer = new Timer();
var status_update_timer = new Timer();
var longterm_reconnect = new ScheduledEvent(On_longterm_reconnect,"Periodic","Minutes",60);
var connect_success_timer = new Timer();

var status_update_interval = 1000;
var successful_connection_interval = 3000;
var reconnect_interval = 500;
var ping_interval = 16000;

// Status / Global Vars
var LOGGED_IN = 0;
var CONSECUTIVE_RECONNECT_FAILURES = 0;
var CONSECUTIVE_RECONNECT_FAILURES_MAX = 1000;
var PENTAIR_PORT = 80;
var PENTAIR_IP = Config.Get('Pentair_IP');
var NumCircuits = Config.Get('Num_Pool_Circuits');

var MESSAGE_QUEUE = new_zeroed_array(100);
var MESSAGE_QUEUE_NEXT = 0;

var CIRCUITS_MAP = {};

//open connection, start status timer
build_circuits_map_from_config();
g_comm.Open(PENTAIR_IP, PENTAIR_PORT);
status_update_timer.Start(On_status_update_timer,status_update_interval);
longterm_reconnect.Enable();


function build_circuits_map_from_config() {
    for(i=1;i <= NumCircuits; i++) {
        CIRCUITS_MAP[Config.Get('CircuitID_'+i).toString()] = 'PENTAIR_circuit'+i+'state';
    }
}

//
// Internal Functions
//

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

function Pool_Get_Status(){
    var hdr = new Array(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(12526);
    hdr[3] = get_word32_byte2(12526);
    var data_buffer = new Array(4);
    data_buffer[0] = 0;
    data_buffer[1] = 0;
    data_buffer[2] = 0;
    data_buffer[3] = 0;
    var msg = decorate_pentair_message(hdr,data_buffer);
    return msg;
}

// Send this message to keep connection alive
function Ping_Message(){
    // see codes - 0,16
    var hdr = new Array(4);
    hdr[0] = get_word32_byte3(0);
    hdr[1] = get_word32_byte2(0);
    hdr[2] = get_word32_byte3(16);
    hdr[3] = get_word32_byte2(16);
    var msg = decorate_pentair_message(hdr,null);
    return msg;
}

/////////////////////////////////////////////////////
///////////////// PROCESS RESPONSES /////////////////
/////////////////////////////////////////////////////
function Pool_Get_Status_Response(data) {
    const data_offset = 8;
    var body_count = get_word32_as_little_endian(data,data_offset + 16);
    if(body_count > 2){
        body_count = 2;
    }
    var cur_idx = 20;
    for(i=0;i < body_count; i++){
        cur_idx = cur_idx+24;
    }
    const circuit_count = get_word32_as_little_endian(data,data_offset + cur_idx);
    cur_idx = cur_idx+4;
    var circuit_ids = new Array(circuit_count);
    var circuit_states = new Array(circuit_count);
    var circuit_color_pos = new Array(circuit_count);
    var circuit_color_stagger = new Array(circuit_count);
    var circuit_color_delay = new Array(circuit_count);
    var circuit_color_set = new Array(circuit_count);
    for(i=0;i < circuit_count;i++){
        circuit_ids[i] = get_word32_as_little_endian(data,data_offset + cur_idx);
        cur_idx = cur_idx+4;
        circuit_states[i] = get_word32_as_little_endian(data,data_offset + cur_idx);
        cur_idx = cur_idx+4;
        circuit_color_set[i] = data[data_offset + cur_idx];
        cur_idx = cur_idx+1;
        circuit_color_pos[i] = data[data_offset + cur_idx];
        cur_idx = cur_idx+1;
        circuit_color_stagger[i] = data[data_offset + cur_idx];
        cur_idx = cur_idx+1;
        circuit_color_delay[i] = data[data_offset + cur_idx];
        cur_idx = cur_idx+1;
    }
    //Now update system variables
    for(i=0;i < circuit_count; i++){
        var circ_id = circuit_ids[i].toString();
        if(circ_id in CIRCUITS_MAP){
            if(circuit_states[i] == 0){
                SystemVars.Write(CIRCUITS_MAP[circ_id],false);
            } else {
                SystemVars.Write(CIRCUITS_MAP[circ_id],true);
            }
        }
    }
}


//////////////////////////////////////////////////////
//////////////// DATA STRUCTURES /////////////////////
//////////////////////////////////////////////////////

function queue_message(message) {
    MESSAGE_QUEUE[MESSAGE_QUEUE_NEXT] = message;
	MESSAGE_QUEUE_NEXT = MESSAGE_QUEUE_NEXT + 1;
}

function dequeue_message() {
	if (MESSAGE_QUEUE_NEXT > 0) {
		var message = MESSAGE_QUEUE[0];
        for(i=1;i < MESSAGE_QUEUE_NEXT;i++){
            MESSAGE_QUEUE[i-1] = MESSAGE_QUEUE[i];
        }
        MESSAGE_QUEUE_NEXT = MESSAGE_QUEUE_NEXT - 1;
		return message;
	}
	return null;
}

/////////////////////////////////////////////////////
/////////////////// SEND MESSAGES ///////////////////
/////////////////////////////////////////////////////

function OnCommRX(string_dat){
    var data = unpack_message_fromstring(string_dat);
    var hdr1 = get_word16_as_little_endian(data,0);
    var hdr2 = get_word16_as_little_endian(data,2);
	
    System.LogInfo(1,'PENTAIR DRIVER - Recieved Message: '+hdr1.toString()+','+hdr2.toString()+'\r\n');

    if(hdr1 == 0 && hdr2 == 12527) {
        Pool_Get_Status_Response(data);
    }
}


function OnTCPConnect() {
	g_comm.SetTxInterMsgDelay(100);
    send_login_after_open();

    // Update Status
    LOGGED_IN = 1;
    CONSECUTIVE_RECONNECT_FAILURES = CONSECUTIVE_RECONNECT_FAILURES + 1;

    // Reset and Start Timers
    ping_timer.Stop();
    reconnnect_timer.Stop();
    connect_success_timer.Stop();
    connect_success_timer.Start(On_successful_connect_timer,successful_connection_interval);
    ping_timer.Start(On_ping_timer,ping_interval);
}

function OnTCPDisconnect() {
	System.LogInfo(1,"PENTAIR DRIVER - Disconnected From Pentair System\r\n");
    g_comm.Close();
    LOGGED_IN = 0;
    ping_timer.Stop();
    reconnnect_timer.Stop();
    connect_success_timer.Stop();
    if( CONSECUTIVE_RECONNECT_FAILURES < CONSECUTIVE_RECONNECT_FAILURES_MAX ){
        reconnnect_timer.Start(On_reconnect_timer,reconnect_interval);
    }   
}

function OnConnectFailed() {
	System.LogInfo(3,"PENTAIR DRIVER - Did Not Connect to Pentair System\r\n");
    g_comm.Close();
    LOGGED_IN = 0;
    connect_success_timer.Stop();
    if( CONSECUTIVE_RECONNECT_FAILURES < CONSECUTIVE_RECONNECT_FAILURES_MAX ){
        g_comm.Open(PENTAIR_IP,PENTAIR_PORT);
    }
}

function On_reconnect_timer(){
    System.LogInfo(1,'PENTAIR DRIVER - Trying to reconnect\r\n');
    g_comm.Open(PENTAIR_IP,PENTAIR_PORT);
}

function On_ping_timer(){
    System.LogInfo(1,'PENTAIR DRIVER - Sending ping message\r\n');
    if(LOGGED_IN == 1){
        const ping_msg = Ping_Message();
        const ping_msg_string = pack_message_tostring(ping_msg);
        g_comm.Write(ping_msg_string);
        ping_timer.Stop();
        ping_timer.Start(On_ping_timer,ping_interval);
    }
}

function On_longterm_reconnect(){
    System.LogInfo(1,'PENTAIR DRIVER - Longterm Connection Check\r\n');
    if(LOGGED_IN == 0){
        g_comm.Open(PENTAIR_IP,PENTAIR_PORT);
    }
}

function On_successful_connect_timer() {
    System.LogInfo(1,'PENTAIR DRIVER - Log In and Connect Successful\r\n');
    CONSECUTIVE_RECONNECT_FAILURES = 0;
}

function On_status_update_timer(){
    System.LogInfo(1,'PENTAIR DRIVER - Updating Circuit Status \r\n');
    var status_query = Pool_Get_Status();
    queue_message(status_query);
    send_message_queue();
    if(CONSECUTIVE_RECONNECT_FAILURES < CONSECUTIVE_RECONNECT_FAILURES_MAX){
        status_update_timer.Start(On_status_update_timer,status_update_interval);
    } else{
        //set all to false
        for(var circ_id in CIRCUITS_MAP){
            SystemVars.Write(CIRCUITS_MAP[circ_id],false);
        }
    }
}

function send_login_after_open(){
    System.LogInfo(1,'PENTAIR DRIVER - Sending Login Message\r\n');

    const scm = create_incoming_connection_message();

    var empty_data = new_zeroed_array(16);
    var login_data = create_login_message_data(348,0,'Android',empty_data,2);
    var login_headers = new_zeroed_array(4);
    login_headers[0] = get_word32_byte3(0);
    login_headers[1] = get_word32_byte2(0);
    login_headers[2] = get_word32_byte3(27);
    login_headers[3] = get_word32_byte2(27);
    var login_msg = decorate_pentair_message(login_headers,login_data);
    
    var login_msg_string = pack_message_tostring(login_msg);
    var scm_msg_string = pack_message_tostring(scm)
    g_comm.Write(scm_msg_string);
    g_comm.Write(login_msg_string);
}

function send_message_queue(){
    if(LOGGED_IN == 0){
        var openState = g_comm.Open(PENTAIR_IP, PENTAIR_PORT);
    }
    var message = dequeue_message();
    while(message != null){
        System.LogInfo(1,'PENTAIR DRIVER - Sending Message\r\n');
        msg_string = pack_message_tostring(message);
        g_comm.Write(msg_string);
        message = dequeue_message();
    }
}

//
//  External Functions
//
function MSGControlCircuit(circ_id,state) {
    var circuit_set_msg = Pool_Set_Buttonpress(0,circ_id,state);
    queue_message(circuit_set_msg);
    send_message_queue();
}