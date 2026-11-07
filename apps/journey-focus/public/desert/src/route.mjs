import {DESERT_STOPS} from '/src/desert-journey.mjs';
// Virtual route positions. The legacy kilometer field is a dimensionless scene unit.
export const stations=DESERT_STOPS.map((name,index)=>({name,index,kilometer:index,elapsedMinutes:index*5}));
