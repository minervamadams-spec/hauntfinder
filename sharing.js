// Homepage ?house= deep links (share links and listing-page "See on the map"):
// select the house and show its card, gated by entity for reused slots. House
// sharing itself (suggested post, listing image) lives on /listing.html#share
// (page-first plan steps 3 and 5); the house-share dialog is removed.
const linkedHouse=Number(new URLSearchParams(location.search).get('house'));if(listings.some(x=>x.num===linkedHouse&&!x.placeholder&&(!isReusedSlot(x)||new URLSearchParams(location.search).get('entity')===x.entityId))){selectListing(linkedHouse);document.querySelector(`[data-card="${linkedHouse}"]`)?.scrollIntoView({block:'center'});}

const linkedHouseListing=listings.find(x=>x.num===linkedHouse&&!x.placeholder);if(linkedHouseListing&&isReusedSlot(linkedHouseListing)&&new URLSearchParams(location.search).get('entity')!==linkedHouseListing.entityId){const note=document.createElement('p');note.className='listing-status';note.textContent='The former display #8, Skully’s Costume Closet, is now in Events. Display #8 is now Drakestown Road Display.';document.getElementById('cardList').before(note);}
