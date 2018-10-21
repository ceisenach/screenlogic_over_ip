# ScreenLogic2 over IP


## node-screenlogic-over-ip
A Javascript module using the CommonJS module system that exposes a partial implementation of Pentair Screenlogic 2 IP protocol. It is designed to require minimal dependencies and it is backwards compatible with Javascript 1.7. This allows the library to be easily ported to old Javascript engines such as those found in some home automation equipment. In particular it is independent of any specific socket / communications libraries, as those can be platform specific.  Portability is the main design criterion (rather than efficiency) because the total volume of messages sent/received in any possible application will be very low.


## Protocol Document
The protocol document describes the IP protocol used by the ScreenLogic2. It is still a work in progress but it is fairly complete
at this point. If you receive a message code back from the Pentair that is not listed in the document, please send me the *first four bytes* 
of the byte sequence received. I will try to determine what the message code means and update the document. Please also let me know 
of any mistakes you find in the document itself.


## RTI Driver
A simple RTI driver that exposes some of the Pentair Screenlogic Protocol. It is based on a browserified version of node-screenlogic-over-ip.