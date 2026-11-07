import {SONGDO_STOPS} from '/src/songdo-journey.mjs';
// Virtual route positions. The legacy kilometer field is a dimensionless scene unit.
export const stations=SONGDO_STOPS.map((name,index)=>({name,index,kilometer:index,elapsedMinutes:index*5}));
