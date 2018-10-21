function expand_array(old_array,add_length){
    const current_buffer_length = old_array.length;
    var new_buffer = new Array(current_buffer_length+add_length);
    //copy old buffer
    for(i=0;i < current_buffer_length; i++){
        new_buffer[i] = this.data[i];
    }
    return new_buffer;
}

// UInt32 is represented Big Endian
// so byte 0 is the **most** significant byte, byte 3 is least significant
function byte_from_UInt32BE(num,byte_num){
    var shift_amount = 8*(3-byte_num);
    return (num >> shift_amount) & 0xFF;
}

function read_bytesLE(byte_array,num_bytes,consume){
    var result = 0;
    if(byte_array.length >= num_bytes) {
        if(consume) {
            for(var i = 0; i < num_bytes; i++) {
                var next_num = byte_array.shift();
                result = result + ((next_num & 0xFF) << (8*i));
            }
        } else {
            for(var i = num_bytes-1; i > 0; i--) {
                result = result + (byte_array[i] & 0xFF) << 8;
            }
            result  = result + (byte_array[i] & 0xFF);
        }
    }
    return result;
}

function ArrayBuffer(len=0){
    this.data = new Array(len);
    for(var i=0; i < len; i++){
        this.data[i] = 0;
    }
    this.length = function(){
        return this.data.length;
    }
    this.writeUInt8LE = function(num) {
        const current_buffer_length = this.data.length;
        this.data.push(byte_from_UInt32BE(num,3));
    };
    this.writeUInt16LE = function(num) {
        const current_buffer_length = this.data.length;
        this.data.push(byte_from_UInt32BE(num,3));
        this.data.push(byte_from_UInt32BE(num,2));
    };
    this.writeUInt32LE = function(num) {
        this.data.push(byte_from_UInt32BE(num,3));
        this.data.push(byte_from_UInt32BE(num,2));
        this.data.push(byte_from_UInt32BE(num,1));
        this.data.push(byte_from_UInt32BE(num,0));
    };
    this.writeString = function(s) {
        var string_length = s.length;
        var padding = 4 - (string_length % 4);
        //Write length
        this.writeUInt32LE(string_length);
        //Write string
        for(i=0; i < string_length; i++){
            this.data.push(s.charCodeAt(i));
        }
        //add zero padding
        for(i=0; i < padding; i++){
            this.data.push(0);
        }
    };
    this.writeStringRaw = function(s) {
        var string_length = s.length;
        for(i=0; i < string_length; i++){
            this.data.push(s.charCodeAt(i));
        }
    };
    this.writeBuffer = function(buf) {
        var buf_length = buf.length();
        this.writeUInt32LE(buf_length);
        for(i = 0; i < buf_length; i++){
            this.data.push(buf[i])
        }
    };
    //This means it is stored in array in LE form
    this.readUInt32LE = function(consume=true) {
        return read_bytesLE(this.data,4,consume);
    };
    //This means it is stored in array in LE form
    this.readUInt16LE = function(consume=true) {
        return read_bytesLE(this.data,2,consume);
    };
    //This means it is stored in array in LE form
    this.readUInt8LE = function(consume=true) {
        return read_bytesLE(this.data,1,consume);
    };
    this.readString = function() {
        var s = "";
        var EXTRACT_STRING_TYPE = 1;
        if((this.data[3] & 0x80) != 0) {
            console.log('TYPE 2 STRING');
            EXTRACT_STRING_TYPE = 2; //This means it is UTF16 -- might not work
            this.data[3] = this.data[3] + 128;
            var string_length = this.readUInt32LE();
            for(var i = 0; i < string_length; i++){
                s = s + String.fromCharCode(this.readUInt16LE());
            }
        } else {
            var string_length = this.readUInt32LE();
            for(var i = 0; i < string_length; i++){
                s = s + String.fromCharCode(this.shift());
            }
        }

        // remove any padding
        var cn_padding = EXTRACT_STRING_TYPE*s.length % 4;
        if(cn_padding != 0){
            cn_padding = 4-cn_padding;
        }
        for(var i=0; i < cn_padding; i++) {
            this.shift();
        }
        return s;
    }
    //convert stringified message to byte array
    this.fillFromString = function(str){
        this.data = new Array();
        for(var i = 0; i < str.length; i++) {
            this.data.push(str.charCodeAt(i));
        }
    };
    this.fillString = function(){
        var str = "";
        for(var i = 0; i < this.data.length; i ++) {
            str += String.fromCharCode(this.data[i]);
        }
        return str;
    };

    this.push = function(byt) {
        this.data.push(byt);
    };

    this.shift = function() {
        return this.data.shift();
    };
}

// Can be used for any object that supports
// array-like interface
function ArrayLikeToString(arr) {
    var str = "";
    for(var i = 0; i < arr.length; i ++) {
        str += String.fromCharCode(arr[i]);
    }
    return str;
}

module.exports.ArrayBuffer = ArrayBuffer;
module.exports.ArrayLikeToString = ArrayLikeToString