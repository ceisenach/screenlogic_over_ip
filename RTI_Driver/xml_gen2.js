
for(i=1;i<50;i++) {
	console.log('<variable name="Circuit %%CircuitID_'+i+'%%" sysvar="PENTAIR_circuit'+i+'state" type="boolean" condition="$Num_Pool_Circuits >= '+i+'" />')
}