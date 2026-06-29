const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Skip the first few lines where the definitions of safeGetItem are
const defIndex = code.indexOf('export const safeRemoveItem');
if (defIndex > -1) {
  const afterDefIndex = code.indexOf('}', defIndex) + 1;
  const topPart = code.substring(0, afterDefIndex);
  let restPart = code.substring(afterDefIndex);
  
  restPart = restPart.replace(/localStorage\.getItem/g, 'safeGetItem');
  restPart = restPart.replace(/localStorage\.setItem/g, 'safeSetItem');
  restPart = restPart.replace(/localStorage\.removeItem/g, 'safeRemoveItem');
  
  fs.writeFileSync('src/App.tsx', topPart + restPart);
  console.log("Done");
} else {
  console.error("Def not found");
}
