
//////////////////////////////////////////////////////////////////////
//////////////////////// UTILITY FUNCTIONS ///////////////////////////
//////////////////////////////////////////////////////////////////////

function get_word32_as_little_endian(byte_array,offset) {
    var result = 0;
    if (byte_array.length >= offset + 4) {
        result = (((0 + (byte_array[offset + 3] & 0xFF) << 8) + (byte_array[offset + 2] & 0xFF) << 8) + (byte_array[offset + 1] & 0xFF) << 8) + (byte_array[offset + 0] & 0xFF);
    }
    return result;
};

function get_word16_as_little_endian(byte_array,offset) {
    var result = 0;
    if (byte_array.length >= offset + 4) {
        result = (((byte_array[offset + 1] & 0xFF) + 0) << 8) + (byte_array[offset + 0] & 0xFF);
    }
    return result;
};

function get_word32_byte3(num) {
    return (num & 0xFF);
}
function get_word32_byte2(num) {
    return (num >> 8) & 0xFF;
}
function get_word32_byte1(num) {
    return (num >> 16) & 0xFF;
}
function get_word32_byte0(num) {
    return (num >> 24) & 0xFF;
}

function push_string_to_buffer(buf,s) {
    var string_length = s.length;
    var current_buffer_length = buf.length;
    var padding = 4 - (string_length % 4);

    //allocate new buffer
    var new_buffer = new_zeroed_array(current_buffer_length+string_length+padding+4);

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
    var new_buffer = new Array(current_buffer_length+4);
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
    var new_buffer = new Array(current_buffer_length+2);
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
    var new_buffer = new Array(current_buffer_length+1);
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
    var new_buffer = new Array(buf_length+buf_2_length+4);

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

function pack_message_tostring(bytes) {
    var str = "";
    for(var i = 0; i < bytes.length; i ++) {
        str += String.fromCharCode(bytes[i]);
    }
    return str;
}

function unpack_message_fromstring(str) {
    var bytes = new Array(str.length);
    for(var i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}

function new_zeroed_array(length){
	nza = new Array(length);
	for(i=0;i<length;i++){
		nza[i]=0;
	}
	return nza;
}