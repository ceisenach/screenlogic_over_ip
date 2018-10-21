var slm = require('./SLMessage');
var du = require('./data_utils');


function pentair_connect_and_login() {
    console.log('\r\n-----------------------------------------------');
    console.log('----- CONNECTING TO PENTAIR SCREENLOGIC -------')
    console.log('-----------------------------------------------\r\n');

    // Intial Connection Message
    const scm = new slm.IncomingConnectionPacket();

    // Log In Message
    const login_msg = new slm.LoginQuery();
    const status_query = new slm.StatusQuery();
    const control_config_query = new slm.ControllerConfigQuery()
    const net = require('net');
    const client = net.connect({host: '10.1.68.130', port: 80}, () => {
        // 'connect' listener
        console.log('Connected to Pentair Server! Logging in...');
        client.write(scm.fillString());
        setTimeout(() => {client.write(login_msg.fillString(),'ascii');},100);

        /// Example of sending messages
        ccqs = control_config_query.fillString()
        setTimeout(() => {client.write(ccqs,'ascii');},200);
        sqs = status_query.fillString();
        setTimeout(() => {client.write(sqs,'ascii');},300);
        // console.log(Buffer.from(sqs,'ascii'))
        //setTimeout(() => {client.write(ping_msg);},300);
        //setTimeout(() => {client.write(lights_set_msg);},300);
        //setTimeout(() => {client.write(spahigh_set_msg);},400);
        //setTimeout(() => {client.write(heatmode_set_msg);},400);
    });
    client.on('data', (data) => {
      console.log('\r\n*******************************')
      console.log('****** BEGIN TCP RESPONSE *****')  
      console.log('*******************************\r\n')
      console.log('RESPONSE DATA BUFFER: ')
      console.log(data);
      resp = slm.ParseResponsePacket(du.ArrayLikeToString(data))
      // console.log('MESSAGE CODES: '+get_word16_as_little_endian(data,0)+','+get_word16_as_little_endian(data,2))
      // process_pentair_response(data);
      console.log('\r\n*******************************')
      console.log('****** END TCP RESPONSE *******')  
      console.log('*******************************\r\n')
    });
    client.on('end', () => {
      console.log('Disconnected from server!');
    });
            
}

setTimeout(pentair_connect_and_login,500);
