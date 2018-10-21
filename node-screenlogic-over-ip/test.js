var slm = require('./SLMessage');
var du = require('./data_utils');

var mess = new slm.SL_LoginMessageQuery();
// console.log(mess.message_header.length())
console.log(mess.message_content.length())
const buf = Buffer.from(mess.fillString());
console.log(buf)
// console.log(mess.fillString())
// console.log(mess.name)

// var buff = new du.ArrayBuffer();
// buff.writeUInt32LE(122185);
// console.log(buff.readUInt32LE(false))
// console.log(buff);
// console.log(buff.readUInt32LE())
// console.log(buff);

mess = new slm.IncomingConnectionPacket();
console.log(mess)
console.log(slm.SL_MESSAGES.SL_LoginMessageQuery)