import {DESERT_STOPS,OASIS_STOPS} from '/src/desert-journey.mjs';
// Virtual route positions. The legacy kilometer field is a dimensionless scene unit.
export const stations=(new URLSearchParams(location.search).get('world')==='oasis'?OASIS_STOPS:DESERT_STOPS).map((name,index)=>({name,index,kilometer:index,elapsedMinutes:index*5}));
