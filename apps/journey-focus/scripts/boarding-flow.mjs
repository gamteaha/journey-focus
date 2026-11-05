import {waitFor} from './cdp.mjs';
import {validDuration} from '../src/journey.mjs';
export async function boardTrain(page,{duration=60,character='blue',medium='ticket'}={}){
 if(!validDuration(duration)||!['blue','mint','amber'].includes(character)||!['ticket','card'].includes(medium))throw Error('Invalid boarding fixture');
 if(!await waitFor(page,`document.querySelector('#boarding-next')?.disabled===false`,30000))throw Error('Ticket office not ready');
 await page.evaluate(`(()=>{document.querySelector('[data-medium="${medium}"]').click();const preset=document.querySelector('[data-duration="${duration}"]');if(preset)preset.click();else{document.querySelector('#focus-hours').value='${Math.floor(duration/3600)}';const minutes=document.querySelector('#focus-minutes');minutes.value='${duration/60%60}';minutes.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('[data-character="${character}"]').click();document.querySelector('#boarding-next').click();document.querySelector('#boarding-use').click();})()`);
 if(!await waitFor(page,`document.querySelector('#boarding-screen').hidden&&document.querySelector('#cabin-root')?.dataset.ready==='true'`,120000))throw Error('Cabin not ready after boarding');
}
