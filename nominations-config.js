// Google Forms behind the community-spotted flow. Both are NEW forms with their own
// response sheets ("Nominations", "Claim or remove"); the three existing sheets are
// untouched. Fill in the formResponse URL and the entry.NNN id of each question.
// While `action` is empty the pages say nominations are not open and send nothing.
window.HF_NOMINATIONS = {
  nominate: {
    action: '', // https://docs.google.com/forms/d/e/<FORM_ID>/formResponse
    entries: {} // street, town, lat, lng, photo, why, best, litUntil, nickname, email
  },
  claim: {
    action: '',
    entries: {} // address, listing, request, email
  },
  photoApi: '/api/nomination-photo'
};
