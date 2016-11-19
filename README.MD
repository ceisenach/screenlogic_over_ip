# ScreenLogic2 over IP

The script send_message.js sends some example messages to the ScreenLogic2 device
over the LAN.

The protocol document describes the IP protocol used by the ScreenLogic2. It is not
complete as of now, but hopefully will be fleshed out in the near future. If you recieve
a message code back from the Pentair that is not listed in the document, please send
me the *first four bytes* of the byte sequence received. I will try to determine what
the message code means and update the document. Please also let me know of any mistakes
you find in the document itself.

## Coming Soon!
An RTI driver to integrate the ScreenLogic2 with home automation.