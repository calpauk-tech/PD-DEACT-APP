
const targets = [{label: 'Skill - CPR'}];
const lower = 'skill: cpr (x)';
const prefixMatch = lower.match(/^(skill|department|employee group|group)\s*[:-]\s*(.*)$/i);
let category = '';
let itemName = '';
if (prefixMatch) {
    category = prefixMatch[1].toLowerCase();
    itemName = prefixMatch[2].trim();
}
// check earlier cleanLower logic
const cleanLower = lower.replace(/[^a-z0-9]/g, '');
// wait, the previous logic did: if (!match) cleanLower... break;
// Ah! Wait! The cleanLower alias code runs inside `if (!match)`
// And THEN we have another `if (!match)` where the prefix logic runs:
//     if (!match) {
//         const prefixMatch = lower.match(/.../);
//     }
// Let's print out what we get
console.log({
    prefixMatch: !!prefixMatch,
    category,
    itemName,
    cleanItemName: itemName.replace(/\(x\)$/i, '').trim().toLowerCase()
});
